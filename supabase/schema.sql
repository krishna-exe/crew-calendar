-- Crew Calendar schema. Paste into Supabase: SQL Editor → New query → Run.

-- People ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at timestamptz not null default now()
);

-- Create a profile for every new sign-up, named after their email.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(split_part(new.email, '@', 1), 40));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rooms ----------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default substr(md5(gen_random_uuid()::text), 1, 10),
  created_by uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.rooms on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- One row per person per day they did the thing.
create table public.checkins (
  room_id uuid not null,
  user_id uuid not null,
  day date not null,
  note text not null default '' check (char_length(note) <= 140),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id, day),
  foreign key (room_id, user_id) references public.room_members on delete cascade
);

-- Helpers (security definer so policies don't recurse into room_members) --
create function public.is_member(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from room_members where room_id = r and user_id = auth.uid())
$$;

create function public.is_owner(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rooms where id = r and created_by = auth.uid())
$$;

-- Row level security -----------------------------------------------------
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.checkins enable row level security;

-- You can see yourself and anyone you share a room with.
create policy "profiles: read self and roommates" on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from room_members a join room_members b on a.room_id = b.room_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy "profiles: edit self" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy "rooms: members read" on public.rooms for select using (is_member(id));
create policy "rooms: owner renames" on public.rooms for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "rooms: owner deletes" on public.rooms for delete using (created_by = auth.uid());

create policy "members: members read" on public.room_members for select using (is_member(room_id));
-- Leave a room yourself, or (as owner) remove someone else. Owners can't remove themselves.
create policy "members: leave or remove" on public.room_members for delete using (
  (user_id = auth.uid() and role <> 'owner') or (is_owner(room_id) and user_id <> auth.uid())
);

create policy "checkins: members read" on public.checkins for select using (is_member(room_id));
-- Only your own check-ins, only up to today (+1 day of timezone slack).
create policy "checkins: add own" on public.checkins for insert with check (
  user_id = auth.uid() and is_member(room_id) and day <= current_date + 1
);
create policy "checkins: edit own" on public.checkins for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_member(room_id));
create policy "checkins: remove own" on public.checkins for delete using (user_id = auth.uid());

-- Actions ----------------------------------------------------------------
create function public.create_room(room_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into rooms (name, created_by) values (trim(room_name), auth.uid()) returning id into r;
  insert into room_members (room_id, user_id, role) values (r, auth.uid(), 'owner');
  return r;
end $$;

-- What an invite link shows before you join.
create function public.room_preview(code text)
returns table (id uuid, name text, member_count int, already_member boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.name,
    (select count(*)::int from room_members m where m.room_id = r.id),
    exists (select 1 from room_members m where m.room_id = r.id and m.user_id = auth.uid())
  from rooms r where r.invite_code = lower(trim(code)) and auth.uid() is not null
$$;

create function public.join_room(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id into r from rooms where invite_code = lower(trim(code));
  if r is null then raise exception 'This invite link is invalid or has been reset'; end if;
  insert into room_members (room_id, user_id) values (r, auth.uid()) on conflict do nothing;
  return r;
end $$;

-- Owner makes a fresh invite link; the old one stops working.
create function public.reset_invite(r uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_owner(r) then raise exception 'Only the room owner can reset the invite link'; end if;
  update rooms set invite_code = substr(md5(gen_random_uuid()::text), 1, 10) where id = r
    returning invite_code into c;
  return c;
end $$;

revoke execute on function public.create_room, public.room_preview, public.join_room,
  public.reset_invite, public.is_member, public.is_owner from public, anon;
grant execute on function public.create_room, public.room_preview, public.join_room,
  public.reset_invite, public.is_member, public.is_owner to authenticated;

-- Live updates for new check-ins, member joins, and room renames.
alter publication supabase_realtime add table public.checkins, public.room_members, public.rooms;
