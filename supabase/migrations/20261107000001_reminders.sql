-- Daily reminders by web push. Each device has its own time and timezone.
-- Needs extensions only hosted Supabase has.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  user_id uuid not null references public.profiles on delete cascade,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  remind_hour smallint not null check (remind_hour between 0 and 23),
  time_zone text not null,
  last_reminded_on date,
  created_at timestamptz not null default now()
);
create index on private.push_subscriptions (user_id);

-- A device belongs to whoever enabled reminders on it last.
create function public.set_reminder(sub_endpoint text, sub_p256dh text, sub_auth text, hour int, tz text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from pg_timezone_names where name = tz) then
    raise exception 'Unknown timezone';
  end if;
  insert into private.push_subscriptions (endpoint, user_id, p256dh, auth, remind_hour, time_zone)
  values (sub_endpoint, auth.uid(), sub_p256dh, sub_auth, hour, tz)
  on conflict (endpoint) do update set
    user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    remind_hour = excluded.remind_hour, time_zone = excluded.time_zone;
end $$;

create function public.get_reminder_hour(sub_endpoint text)
returns int language sql stable security definer set search_path = public as $$
  select remind_hour from private.push_subscriptions
  where endpoint = sub_endpoint and user_id = auth.uid()
$$;

create function public.clear_reminder(sub_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from private.push_subscriptions where endpoint = sub_endpoint and user_id = auth.uid()
$$;

-- Marks each device that's due as reminded today, so concurrent runs can't send
-- twice, and returns those with a room still waiting. A room isn't waiting on its
-- rest day or once checked in.
create function public.claim_due_reminders()
returns table (endpoint text, p256dh text, auth text, room_ids uuid[])
language sql security definer set search_path = public as $$
  with claimed as (
    update private.push_subscriptions s
    set last_reminded_on = (now() at time zone s.time_zone)::date
    where extract(hour from now() at time zone s.time_zone) = s.remind_hour
      and (s.last_reminded_on is null or s.last_reminded_on < (now() at time zone s.time_zone)::date)
    returning s.endpoint, s.p256dh, s.auth, s.user_id, s.last_reminded_on as local_day
  )
  select c.endpoint, c.p256dh, c.auth, array_agg(r.id)
  from claimed c
  join room_members m on m.user_id = c.user_id
  join rooms r on r.id = m.room_id
  where not (extract(dow from c.local_day)::smallint = any (r.rest_days))
    and not exists (
      select 1 from checkins k
      where k.room_id = r.id and k.user_id = c.user_id and k.day = c.local_day
    )
  group by c.endpoint, c.p256dh, c.auth
$$;

create function public.remove_push_subscriptions(endpoints text[])
returns void language sql security definer set search_path = public as $$
  delete from private.push_subscriptions where endpoint = any (endpoints)
$$;

revoke execute on function public.set_reminder, public.get_reminder_hour, public.clear_reminder,
  public.claim_due_reminders, public.remove_push_subscriptions from public, anon, authenticated;
grant execute on function public.set_reminder, public.get_reminder_hour, public.clear_reminder to authenticated;
grant execute on function public.claim_due_reminders, public.remove_push_subscriptions to service_role;

-- Wakes the sender only when a device is due. Every 15 minutes, because timezones
-- like India's are offset by 30 minutes, so a local hour starts mid-way through a UTC one.
create function private.wake_reminder_sender() returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from private.push_subscriptions s
    where extract(hour from now() at time zone s.time_zone) = s.remind_hour
      and (s.last_reminded_on is null or s.last_reminded_on < (now() at time zone s.time_zone)::date)
  ) then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_secret')
      )
    );
  end if;
end $$;

select cron.schedule('crew-calendar-reminders', '*/15 * * * *', 'select private.wake_reminder_sender()');
