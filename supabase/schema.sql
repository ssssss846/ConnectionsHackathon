create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text,
  zid text,
  unsw_email text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists zid text;
alter table public.profiles add column if not exists unsw_email text;

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
    unsw_email
  )
  values (
    new.id,
    coalesce(lower(new.raw_user_meta_data ->> 'username'), lower(new.raw_user_meta_data ->> 'zid')),
    new.raw_user_meta_data ->> 'full_name',
    lower(new.raw_user_meta_data ->> 'zid'),
    lower(coalesce(new.raw_user_meta_data ->> 'unsw_email', new.email))
  )
  on conflict (id) do update
  set
    username = excluded.username,
    full_name = excluded.full_name,
    zid = excluded.zid,
    unsw_email = excluded.unsw_email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
  friend_user_id uuid not null references public.profiles (id) on delete cascade,
  term text not null,
  title text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint shared_term_plans_term_check check (term in ('T1', 'T2', 'T3')),
  constraint shared_term_plans_distinct_users check (owner_user_id <> friend_user_id)
);

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

alter table public.profiles enable row level security;
alter table public.user_term_subjects enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.shared_term_plans enable row level security;
alter table public.shared_term_plan_participants enable row level security;
alter table public.shared_term_plan_subjects enable row level security;
alter table public.shared_term_plan_class_choices enable row level security;

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

drop policy if exists "shared plans visible to participants" on public.shared_term_plans;
create policy "shared plans visible to participants"
on public.shared_term_plans
for select
to authenticated
using (auth.uid() = owner_user_id or auth.uid() = friend_user_id);

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
using (auth.uid() = owner_user_id or auth.uid() = friend_user_id)
with check (auth.uid() = owner_user_id or auth.uid() = friend_user_id);

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
      and (auth.uid() = p.owner_user_id or auth.uid() = p.friend_user_id)
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
      and (auth.uid() = p.owner_user_id or auth.uid() = p.friend_user_id)
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
      and (auth.uid() = p.owner_user_id or auth.uid() = p.friend_user_id)
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
      and (auth.uid() = p.owner_user_id or auth.uid() = p.friend_user_id)
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
      and (auth.uid() = p.owner_user_id or auth.uid() = p.friend_user_id)
  )
)
with check (
  exists (
    select 1
    from public.shared_term_plans p
    where p.id = plan_id
      and (auth.uid() = p.owner_user_id or auth.uid() = p.friend_user_id)
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
      and (auth.uid() = p.owner_user_id or auth.uid() = p.friend_user_id)
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
      and (auth.uid() = p.owner_user_id or auth.uid() = p.friend_user_id)
  )
)
with check (
  exists (
    select 1
    from public.shared_term_plans p
    where p.id = plan_id
      and (auth.uid() = p.owner_user_id or auth.uid() = p.friend_user_id)
  )
);
