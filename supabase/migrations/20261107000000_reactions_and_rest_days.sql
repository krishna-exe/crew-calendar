-- Rest days: weekdays that don't break a streak. 0 = Sunday, matching JS getDay()
-- and Postgres extract(dow). At least one day must stay active.
alter table public.rooms add column rest_days smallint[] not null default '{}'
  check (rest_days <@ '{0,1,2,3,4,5,6}'::smallint[] and cardinality(rest_days) <= 6);

-- Reactions: a friend's emoji on a check-in. Removing the check-in or either
-- member removes the reaction.
create table public.reactions (
  room_id uuid not null,
  checkin_user_id uuid not null,
  day date not null,
  user_id uuid not null,
  emoji text not null check (emoji in ('🔥', '👏', '💪', '🎉')),
  created_at timestamptz not null default now(),
  primary key (room_id, checkin_user_id, day, user_id, emoji),
  foreign key (room_id, checkin_user_id, day) references public.checkins on delete cascade,
  foreign key (room_id, user_id) references public.room_members on delete cascade,
  check (user_id <> checkin_user_id)
);

alter table public.reactions enable row level security;

create policy "reactions: members read" on public.reactions for select using (is_member(room_id));
create policy "reactions: add own" on public.reactions for insert
  with check (user_id = auth.uid() and is_member(room_id));
create policy "reactions: remove own" on public.reactions for delete using (user_id = auth.uid());

revoke all on public.reactions from anon;
grant select, insert, delete on public.reactions to authenticated;

alter publication supabase_realtime add table public.reactions;
