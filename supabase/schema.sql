create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text,
  zid text,
  unsw_email text,
  degree text,
  enrolled_year integer,
  enrolled_term text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_enrolled_term_check check (enrolled_term is null or enrolled_term in ('T1', 'T2', 'T3'))
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists zid text;
alter table public.profiles add column if not exists unsw_email text;
alter table public.profiles add column if not exists degree text;
alter table public.profiles add column if not exists enrolled_year integer;
alter table public.profiles add column if not exists enrolled_term text;

create unique index if not exists profiles_zid_unique_idx on public.profiles (zid);
create unique index if not exists profiles_unsw_email_unique_idx on public.profiles (unsw_email);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    username,
    full_name,
    zid,
    unsw_email,
    degree,
    enrolled_year,
    enrolled_term
  )
  values (
    new.id,
    coalesce(lower(new.raw_user_meta_data ->> 'username'), lower(new.raw_user_meta_data ->> 'zid')),
    new.raw_user_meta_data ->> 'full_name',
    lower(new.raw_user_meta_data ->> 'zid'),
    lower(coalesce(new.raw_user_meta_data ->> 'unsw_email', new.email)),
    new.raw_user_meta_data ->> 'degree',
    nullif(new.raw_user_meta_data ->> 'enrolled_year', '')::integer,
    new.raw_user_meta_data ->> 'enrolled_term'
  )
  on conflict (id) do update
  set
    username = excluded.username,
    full_name = excluded.full_name,
    zid = excluded.zid,
    unsw_email = excluded.unsw_email,
    degree = excluded.degree,
    enrolled_year = excluded.enrolled_year,
    enrolled_term = excluded.enrolled_term;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.discover_same_degree_mutuals()
returns table (
  id uuid,
  username text,
  full_name text,
  zid text,
  unsw_email text,
  degree text,
  enrolled_year integer,
  enrolled_term text,
  created_at timestamptz,
  mutual_friend_count bigint
)
language sql
security definer
set search_path = public
as $$
  with viewer as (
    select id, degree
    from public.profiles
    where id = auth.uid()
  ),
  direct_friends as (
    select case when f.user_a_id = auth.uid() then f.user_b_id else f.user_a_id end as friend_id
    from public.friendships f
    where f.user_a_id = auth.uid() or f.user_b_id = auth.uid()
  ),
  friend_edges as (
    select
      df.friend_id as mutual_friend_id,
      case when f.user_a_id = df.friend_id then f.user_b_id else f.user_a_id end as candidate_id
    from direct_friends df
    join public.friendships f
      on f.user_a_id = df.friend_id or f.user_b_id = df.friend_id
  )
  select
    p.id,
    p.username,
    p.full_name,
    p.zid,
    p.unsw_email,
    p.degree,
    p.enrolled_year,
    p.enrolled_term,
    p.created_at,
    count(distinct fe.mutual_friend_id) as mutual_friend_count
  from friend_edges fe
  join viewer v on true
  join public.profiles p on p.id = fe.candidate_id
  where p.id <> auth.uid()
    and v.degree is not null
    and p.degree = v.degree
    and not exists (
      select 1
      from direct_friends df
      where df.friend_id = p.id
    )
  group by p.id, p.username, p.full_name, p.zid, p.unsw_email, p.degree, p.enrolled_year, p.enrolled_term, p.created_at
  order by mutual_friend_count desc, p.full_name asc
  limit 20;
$$;

grant execute on function public.discover_same_degree_mutuals() to authenticated;

create or replace function public.discover_friend_same_degree_friends(target_friend_id uuid)
returns table (
  id uuid,
  username text,
  full_name text,
  zid text,
  unsw_email text,
  degree text,
  enrolled_year integer,
  enrolled_term text,
  created_at timestamptz,
  mutual_friend_count bigint
)
language sql
security definer
set search_path = public
as $$
  with viewer as (
    select id, degree
    from public.profiles
    where id = auth.uid()
  ),
  target_friendship as (
    select 1
    from public.friendships f
    where f.user_a_id = least(auth.uid(), target_friend_id)
      and f.user_b_id = greatest(auth.uid(), target_friend_id)
  ),
  viewer_friends as (
    select case when f.user_a_id = auth.uid() then f.user_b_id else f.user_a_id end as friend_id
    from public.friendships f
    where f.user_a_id = auth.uid() or f.user_b_id = auth.uid()
  ),
  target_edges as (
    select case when f.user_a_id = target_friend_id then f.user_b_id else f.user_a_id end as candidate_id
    from public.friendships f
    where f.user_a_id = target_friend_id or f.user_b_id = target_friend_id
  )
  select
    p.id,
    p.username,
    p.full_name,
    p.zid,
    p.unsw_email,
    p.degree,
    p.enrolled_year,
    p.enrolled_term,
    p.created_at,
    count(*)::bigint as mutual_friend_count
  from target_edges te
  join target_friendship tf on true
  join viewer v on true
  join public.profiles p on p.id = te.candidate_id
  where p.id <> auth.uid()
    and p.id <> target_friend_id
    and v.degree is not null
    and p.degree = v.degree
    and not exists (
      select 1
      from viewer_friends vf
      where vf.friend_id = p.id
    )
  group by p.id, p.username, p.full_name, p.zid, p.unsw_email, p.degree, p.enrolled_year, p.enrolled_term, p.created_at
  order by p.full_name asc
  limit 20;
$$;

grant execute on function public.discover_friend_same_degree_friends(uuid) to authenticated;

create table if not exists public.user_term_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  term text not null,
  subject_code text not null,
  subject_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_term_subjects_term_check check (term in ('T1', 'T2', 'T3')),
  constraint user_term_subjects_subject_code_check check (subject_code ~ '^[A-Z]{4}[0-9]{4}$'),
  constraint user_term_subjects_unique unique (user_id, term, subject_code)
);

alter table public.user_term_subjects add column if not exists subject_name text not null default '';
update public.user_term_subjects set subject_name = subject_code where subject_name = '';

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.profiles (id) on delete cascade,
  receiver_user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  constraint friend_requests_status_check check (status in ('pending', 'accepted', 'rejected')),
  constraint friend_requests_distinct_users check (sender_user_id <> receiver_user_id)
);

create unique index if not exists friend_requests_one_pending_pair_idx
  on public.friend_requests (
    least(sender_user_id, receiver_user_id),
    greatest(sender_user_id, receiver_user_id)
  )
  where status = 'pending';

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint friendships_order_check check (user_a_id < user_b_id),
  constraint friendships_distinct_users check (user_a_id <> user_b_id),
  constraint friendships_unique_pair unique (user_a_id, user_b_id)
);

create table if not exists public.shared_term_plans (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  friend_user_id uuid references public.profiles (id) on delete cascade,
  copied_from_plan_id uuid references public.shared_term_plans (id) on delete set null,
  term text not null,
  title text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint shared_term_plans_term_check check (term in ('T1', 'T2', 'T3')),
  constraint shared_term_plans_distinct_users check (friend_user_id is null or owner_user_id <> friend_user_id)
);

alter table public.shared_term_plans alter column friend_user_id drop not null;
alter table public.shared_term_plans add column if not exists copied_from_plan_id uuid references public.shared_term_plans (id) on delete set null;

create unique index if not exists shared_term_plans_owner_copy_unique_idx
  on public.shared_term_plans (owner_user_id, copied_from_plan_id);

create table if not exists public.shared_term_plan_participants (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.shared_term_plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint shared_term_plan_participants_unique unique (plan_id, user_id)
);

create table if not exists public.shared_term_plan_subjects (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.shared_term_plans (id) on delete cascade,
  subject_code text not null,
  selected_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint shared_term_plan_subjects_subject_code_check check (subject_code ~ '^[A-Z]{4}[0-9]{4}$'),
  constraint shared_term_plan_subjects_unique unique (plan_id, subject_code)
);

create table if not exists public.shared_term_plan_class_choices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.shared_term_plans (id) on delete cascade,
  scope_type text not null,
  participant_user_id uuid references public.profiles (id) on delete cascade,
  subject_code text not null,
  activity text not null,
  class_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint shared_term_plan_class_choices_scope_check check (scope_type in ('common', 'individual')),
  constraint shared_term_plan_class_choices_subject_code_check check (subject_code ~ '^[A-Z]{4}[0-9]{4}$')
);

create unique index if not exists shared_term_plan_class_choices_common_idx
  on public.shared_term_plan_class_choices (plan_id, subject_code, activity)
  where scope_type = 'common';

create unique index if not exists shared_term_plan_class_choices_individual_idx
  on public.shared_term_plan_class_choices (plan_id, participant_user_id, subject_code, activity)
  where scope_type = 'individual';

create or replace function public.sync_shared_plan_copies(source_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  source_plan public.shared_term_plans%rowtype;
  participant record;
  copy_plan_id uuid;
begin
  select *
  into source_plan
  from public.shared_term_plans
  where id = source_plan_id
    and owner_user_id = auth.uid();

  if not found then
    raise exception 'You can only copy timetables you own.';
  end if;

  if source_plan.copied_from_plan_id is not null then
    return;
  end if;

  for participant in
    select distinct user_id
    from public.shared_term_plan_participants
    where plan_id = source_plan.id
      and user_id <> source_plan.owner_user_id
  loop
    insert into public.shared_term_plans (
      owner_user_id,
      friend_user_id,
      copied_from_plan_id,
      term,
      title,
      notes
    )
    values (
      participant.user_id,
      null,
      source_plan.id,
      source_plan.term,
      source_plan.title,
      source_plan.notes
    )
    on conflict (owner_user_id, copied_from_plan_id)
    do update
    set
      friend_user_id = null,
      term = excluded.term,
      title = excluded.title,
      notes = excluded.notes
    returning id into copy_plan_id;

    delete from public.shared_term_plan_participants
    where plan_id = copy_plan_id;

    insert into public.shared_term_plan_participants (plan_id, user_id)
    select copy_plan_id, user_id
    from public.shared_term_plan_participants
    where plan_id = source_plan.id
    on conflict (plan_id, user_id) do nothing;

    delete from public.shared_term_plan_class_choices
    where plan_id = copy_plan_id;

    insert into public.shared_term_plan_class_choices (
      plan_id,
      scope_type,
      participant_user_id,
      subject_code,
      activity,
      class_id
    )
    select
      copy_plan_id,
      scope_type,
      participant_user_id,
      subject_code,
      activity,
      class_id
    from public.shared_term_plan_class_choices
    where plan_id = source_plan.id;
  end loop;
end;
$$;

grant execute on function public.sync_shared_plan_copies(uuid) to authenticated;

create table if not exists public.user_interests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  interest text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_interests_interest_check check (interest ~ '^[a-z0-9_ -]{2,40}$'),
  constraint user_interests_unique unique (user_id, interest)
);

create table if not exists public.registered_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id text not null,
  title text not null,
  club_name text,
  category text,
  starts_at timestamptz,
  ends_at timestamptz,
  time_label text,
  location text,
  url text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint registered_events_unique unique (user_id, event_id)
);

create table if not exists public.user_timetable_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  term text not null,
  source_type text not null default 'manual',
  calendar_url text,
  notes text,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_timetable_sources_term_check check (term in ('T1', 'T2', 'T3')),
  constraint user_timetable_sources_source_check check (source_type in ('manual', 'calendar_url', 'auto_reference')),
  constraint user_timetable_sources_unique unique (user_id, term)
);

create table if not exists public.user_timetable_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  term text not null,
  start_at timestamptz,
  end_at timestamptz,
  day_of_week integer not null,
  start_minutes integer not null,
  end_minutes integer not null,
  label text not null default 'Busy',
  location text,
  source_type text not null default 'manual',
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_timetable_blocks_term_check check (term in ('T1', 'T2', 'T3')),
  constraint user_timetable_blocks_day_check check (day_of_week between 1 and 7),
  constraint user_timetable_blocks_minutes_check check (
    start_minutes >= 0
    and end_minutes <= 1440
    and start_minutes < end_minutes
  ),
  constraint user_timetable_blocks_source_check check (source_type in ('manual', 'calendar_url', 'auto_reference'))
);

alter table public.user_timetable_blocks add column if not exists start_at timestamptz;
alter table public.user_timetable_blocks add column if not exists end_at timestamptz;

alter table public.profiles enable row level security;
alter table public.user_term_subjects enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.shared_term_plans enable row level security;
alter table public.shared_term_plan_participants enable row level security;
alter table public.shared_term_plan_subjects enable row level security;
alter table public.shared_term_plan_class_choices enable row level security;
alter table public.user_interests enable row level security;
alter table public.registered_events enable row level security;
alter table public.user_timetable_sources enable row level security;
alter table public.user_timetable_blocks enable row level security;

drop policy if exists "profiles readable by signed in users" on public.profiles;
create policy "profiles readable by signed in users"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
  and full_name is not null
  and zid ~ '^z[0-9]{7}$'
  and unsw_email ~* '^[^@[:space:]]+@([[:alnum:]-]+\\.)*unsw\\.edu\\.au$'
);

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "subjects read self or friend" on public.user_term_subjects;
create policy "subjects read self or friend"
on public.user_term_subjects
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.friendships f
    where (
      f.user_a_id = least(auth.uid(), user_id)
      and f.user_b_id = greatest(auth.uid(), user_id)
    )
  )
);

drop policy if exists "subjects mutate self" on public.user_term_subjects;
create policy "subjects mutate self"
on public.user_term_subjects
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "friend requests visible to participants" on public.friend_requests;
create policy "friend requests visible to participants"
on public.friend_requests
for select
to authenticated
using (auth.uid() = sender_user_id or auth.uid() = receiver_user_id);

drop policy if exists "friend requests insert sender" on public.friend_requests;
create policy "friend requests insert sender"
on public.friend_requests
for insert
to authenticated
with check (auth.uid() = sender_user_id);

drop policy if exists "friend requests update receiver" on public.friend_requests;
create policy "friend requests update receiver"
on public.friend_requests
for update
to authenticated
using (auth.uid() = receiver_user_id)
with check (auth.uid() = receiver_user_id);

drop policy if exists "friendships visible to participants" on public.friendships;
create policy "friendships visible to participants"
on public.friendships
for select
to authenticated
using (auth.uid() = user_a_id or auth.uid() = user_b_id);

drop policy if exists "friendships insert participants" on public.friendships;
create policy "friendships insert participants"
on public.friendships
for insert
to authenticated
with check (auth.uid() = user_a_id or auth.uid() = user_b_id);

drop policy if exists "friendships delete participants" on public.friendships;
create policy "friendships delete participants"
on public.friendships
for delete
to authenticated
using (auth.uid() = user_a_id or auth.uid() = user_b_id);

drop policy if exists "shared plans visible to participants" on public.shared_term_plans;
create policy "shared plans visible to participants"
on public.shared_term_plans
for select
to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists "shared plans insert owner" on public.shared_term_plans;
create policy "shared plans insert owner"
on public.shared_term_plans
for insert
to authenticated
with check (auth.uid() = owner_user_id);

drop policy if exists "shared plans update participants" on public.shared_term_plans;
create policy "shared plans update participants"
on public.shared_term_plans
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists "shared plans delete owner" on public.shared_term_plans;
create policy "shared plans delete owner"
on public.shared_term_plans
for delete
to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists "shared plan subjects visible through plan" on public.shared_term_plan_subjects;
create policy "shared plan subjects visible through plan"
on public.shared_term_plan_subjects
for select
to authenticated
using (
  exists (
    select 1
    from public.shared_term_plans p
    where p.id = plan_id
      and auth.uid() = p.owner_user_id
  )
);

drop policy if exists "shared plan subjects insert through plan" on public.shared_term_plan_subjects;
create policy "shared plan subjects insert through plan"
on public.shared_term_plan_subjects
for insert
to authenticated
with check (
  exists (
    select 1
    from public.shared_term_plans p
    where p.id = plan_id
      and auth.uid() = p.owner_user_id
  )
);

drop policy if exists "shared plan subjects delete through plan" on public.shared_term_plan_subjects;
create policy "shared plan subjects delete through plan"
on public.shared_term_plan_subjects
for delete
to authenticated
using (
  exists (
    select 1
    from public.shared_term_plans p
    where p.id = plan_id
      and auth.uid() = p.owner_user_id
  )
);

drop policy if exists "plan participants visible through plan" on public.shared_term_plan_participants;
create policy "plan participants visible through plan"
on public.shared_term_plan_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.shared_term_plans p
    where p.id = plan_id
      and auth.uid() = p.owner_user_id
  )
);

drop policy if exists "plan participants mutate through plan" on public.shared_term_plan_participants;
create policy "plan participants mutate through plan"
on public.shared_term_plan_participants
for all
to authenticated
using (
  exists (
    select 1
    from public.shared_term_plans p
    where p.id = plan_id
      and auth.uid() = p.owner_user_id
  )
)
with check (
  exists (
    select 1
    from public.shared_term_plans p
    where p.id = plan_id
      and auth.uid() = p.owner_user_id
  )
);

drop policy if exists "plan class choices visible through plan" on public.shared_term_plan_class_choices;
create policy "plan class choices visible through plan"
on public.shared_term_plan_class_choices
for select
to authenticated
using (
  exists (
    select 1
    from public.shared_term_plans p
    where p.id = plan_id
      and auth.uid() = p.owner_user_id
  )
);

drop policy if exists "plan class choices mutate through plan" on public.shared_term_plan_class_choices;
create policy "plan class choices mutate through plan"
on public.shared_term_plan_class_choices
for all
to authenticated
using (
  exists (
    select 1
    from public.shared_term_plans p
    where p.id = plan_id
      and auth.uid() = p.owner_user_id
  )
)
with check (
  exists (
    select 1
    from public.shared_term_plans p
    where p.id = plan_id
      and auth.uid() = p.owner_user_id
  )
);

drop policy if exists "interests read self or friend" on public.user_interests;
create policy "interests read self or friend"
on public.user_interests
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.friendships f
    where (
      f.user_a_id = least(auth.uid(), user_id)
      and f.user_b_id = greatest(auth.uid(), user_id)
    )
  )
);

drop policy if exists "interests mutate self" on public.user_interests;
create policy "interests mutate self"
on public.user_interests
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "registered events read self" on public.registered_events;
create policy "registered events read self"
on public.registered_events
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "registered events mutate self" on public.registered_events;
create policy "registered events mutate self"
on public.registered_events
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "timetable sources read self or friend" on public.user_timetable_sources;
create policy "timetable sources read self or friend"
on public.user_timetable_sources
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.friendships f
    where (
      f.user_a_id = least(auth.uid(), user_id)
      and f.user_b_id = greatest(auth.uid(), user_id)
    )
  )
);

drop policy if exists "timetable sources mutate self" on public.user_timetable_sources;
create policy "timetable sources mutate self"
on public.user_timetable_sources
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "timetable blocks read self or friend" on public.user_timetable_blocks;
create policy "timetable blocks read self or friend"
on public.user_timetable_blocks
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.friendships f
    where (
      f.user_a_id = least(auth.uid(), user_id)
      and f.user_b_id = greatest(auth.uid(), user_id)
    )
  )
);

drop policy if exists "timetable blocks mutate self" on public.user_timetable_blocks;
create policy "timetable blocks mutate self"
on public.user_timetable_blocks
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
