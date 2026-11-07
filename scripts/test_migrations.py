#!/usr/bin/env python3
"""Runs the migrations and access checks on the real project in a transaction that
always rolls back, so nothing is left behind. Any failed check aborts with its message."""
from db import ROOT, sql

MIGRATIONS = sorted((ROOT / 'supabase/migrations').glob('*.sql'))
A, B, C = ('00000000-0000-4000-8000-00000000000' + n for n in 'abc')  # A owns, B joins, C is outside

CHECKS = f"""
do $$
declare
  room uuid;
  n int;
  today date := (now() at time zone 'Asia/Kolkata')::date;

begin
  insert into auth.users (id, email, aud, role) values
    ('{A}', 'a@test.invalid', 'authenticated', 'authenticated'),
    ('{B}', 'b@test.invalid', 'authenticated', 'authenticated'),
    ('{C}', 'c@test.invalid', 'authenticated', 'authenticated');
  insert into rooms (name, created_by) values ('test', '{A}') returning id into room;
  insert into room_members (room_id, user_id, role) values (room, '{A}', 'owner'), (room, '{B}', 'member');
  insert into checkins (room_id, user_id, day) values (room, '{A}', today);

  perform set_config('role', 'authenticated', true);

  -- B reacts to A: allowed, and A can see it.
  perform set_config('request.jwt.claims', '{{"sub":"{B}","role":"authenticated"}}', true);
  insert into reactions (room_id, checkin_user_id, day, user_id, emoji) values (room, '{A}', today, '{B}', '🔥');

  -- B can't react as someone else.
  begin
    insert into reactions (room_id, checkin_user_id, day, user_id, emoji) values (room, '{A}', today, '{A}', '👏');
    raise exception 'FAIL: reacted as another user';
  exception when insufficient_privilege or check_violation then null; end;

  -- Only the fixed emoji set.
  begin
    insert into reactions (room_id, checkin_user_id, day, user_id, emoji) values (room, '{A}', today, '{B}', 'x');
    raise exception 'FAIL: unknown emoji accepted';
  exception when check_violation then null; end;

  -- Outsiders can't see or add reactions.
  perform set_config('request.jwt.claims', '{{"sub":"{C}","role":"authenticated"}}', true);
  select count(*) into n from reactions where room_id = room;
  if n <> 0 then raise exception 'FAIL: outsider read reactions'; end if;
  begin
    insert into reactions (room_id, checkin_user_id, day, user_id, emoji) values (room, '{A}', today, '{C}', '🔥');
    raise exception 'FAIL: outsider reacted';
  exception when insufficient_privilege then null; end;

  -- A can't delete B's reaction, and can't react to their own check-in.
  perform set_config('request.jwt.claims', '{{"sub":"{A}","role":"authenticated"}}', true);
  delete from reactions where room_id = room;
  select count(*) into n from reactions where room_id = room;
  if n <> 1 then raise exception 'FAIL: deleted someone else''s reaction'; end if;
  begin
    insert into reactions (room_id, checkin_user_id, day, user_id, emoji) values (room, '{A}', today, '{A}', '🔥');
    raise exception 'FAIL: reacted to own check-in';
  exception when check_violation then null; end;

  -- Rest days: owner can set valid days; all seven and bad values are rejected; member can't.
  update rooms set rest_days = '{{0,6}}' where id = room;
  begin
    update rooms set rest_days = '{{0,1,2,3,4,5,6}}' where id = room;
    raise exception 'FAIL: seven rest days accepted';
  exception when check_violation then null; end;
  begin
    update rooms set rest_days = '{{7}}' where id = room;
    raise exception 'FAIL: bad weekday accepted';
  exception when check_violation then null; end;
  perform set_config('request.jwt.claims', '{{"sub":"{B}","role":"authenticated"}}', true);
  update rooms set rest_days = '{{1}}' where id = room;
  perform set_config('request.jwt.claims', '{{"sub":"{A}","role":"authenticated"}}', true);
  select cardinality(rest_days) into n from rooms where id = room;
  if n <> 2 then raise exception 'FAIL: member changed rest days'; end if;

  update rooms set rest_days = '{{}}' where id = room;

  -- Reminders: private table is closed, and the sender functions are service-only.
  begin
    perform 1 from private.push_subscriptions;
    raise exception 'FAIL: read private table';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_due_reminders();
    raise exception 'FAIL: user could claim reminders';
  exception when insufficient_privilege then null; end;

  -- Bad input to set_reminder.
  begin
    perform set_reminder('https://push.test/x', 'p', 'a', 25, 'Asia/Kolkata');
    raise exception 'FAIL: hour 25 accepted';
  exception when check_violation then null; end;
  begin
    perform set_reminder('https://push.test/x', 'p', 'a', 20, 'Mars/Base');
    raise exception 'FAIL: bad timezone accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    perform set_reminder('http://internal.test/x', 'p', 'a', 20, 'Asia/Kolkata');
    raise exception 'FAIL: non-https endpoint accepted';
  exception when check_violation then null; end;

  -- A device due now: A has checked in, so A gets nothing; B hasn't, so B gets one.
  perform set_reminder('https://push.test/a', 'p', 'a', extract(hour from now() at time zone 'Asia/Kolkata')::int, 'Asia/Kolkata');
  if get_reminder_hour('https://push.test/a') is null then raise exception 'FAIL: own reminder not visible'; end if;
  perform set_config('request.jwt.claims', '{{"sub":"{B}","role":"authenticated"}}', true);
  if get_reminder_hour('https://push.test/a') is not null then raise exception 'FAIL: read another device'; end if;
  perform clear_reminder('https://push.test/a');
  perform set_reminder('https://push.test/b', 'p', 'a', extract(hour from now() at time zone 'Asia/Kolkata')::int, 'Asia/Kolkata');
  perform set_config('request.jwt.claims', '{{"sub":"{A}","role":"authenticated"}}', true);
  perform set_reminder('https://push.test/a', 'p', 'a', extract(hour from now() at time zone 'Asia/Kolkata')::int, 'Asia/Kolkata');

  perform set_config('role', 'service_role', true);
  select count(*) into n from public.claim_due_reminders() c where room = any (c.room_ids) and c.endpoint = 'https://push.test/b';
  if n <> 1 then raise exception 'FAIL: B was not reminded'; end if;
  select count(*) into n from public.claim_due_reminders();
  if n <> 0 then raise exception 'FAIL: reminded twice in a day'; end if;

  -- A rest day means no reminder.
  perform set_config('role', 'postgres', true);
  update private.push_subscriptions set last_reminded_on = null where endpoint = 'https://push.test/b';
  update rooms set rest_days = array[extract(dow from today)::smallint] where id = room;
  perform set_config('role', 'service_role', true);
  select count(*) into n from public.claim_due_reminders() c where room = any (c.room_ids);
  if n <> 0 then raise exception 'FAIL: reminded on a rest day'; end if;

  -- Undoing a check-in removes its reactions.
  perform set_config('role', 'postgres', true);
  delete from checkins where room_id = room and user_id = '{A}';
  select count(*) into n from reactions where room_id = room;
  if n <> 0 then raise exception 'FAIL: reaction outlived its check-in'; end if;
end $$;
"""

query = 'begin;\n' + '\n'.join(path.read_text() for path in MIGRATIONS) + CHECKS + '\nrollback;'
sql(query)
print(f'passed: {len(MIGRATIONS)} migrations and all access checks, rolled back')
leftover = sql("select to_regclass('public.reactions') as t, (select count(*) from pg_extension where extname = 'pg_cron') as cron, (select count(*) from information_schema.columns where table_name = 'rooms' and column_name = 'rest_days') as col")
print('leftovers:', leftover)
