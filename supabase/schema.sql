-- =============================================================
-- 双燃 Duo Fit · Supabase 初始化脚本
-- 用法：Supabase Dashboard → SQL Editor → 粘贴运行（可重复执行，幂等）
-- =============================================================

-- 1) 成员档案表：把登录账号绑定到两位成员之一
create table if not exists public.profiles (
  id text primary key,                                        -- 'lin' | 'zhou'
  user_id uuid references auth.users (id) on delete set null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- 2) 打卡记录表：两人共享的唯一数据源
create table if not exists public.records (
  id text primary key,
  profile_id text not null references public.profiles (id) on delete cascade,
  date text not null,                                         -- 'YYYY-MM-DD'
  time text,
  calories numeric,
  weight numeric,
  exercise text,
  exercise_id text,
  duration numeric,
  burned numeric,
  water numeric,
  mood text,
  meals jsonb,
  created_at timestamptz not null default now(),
  unique (profile_id, date)                                   -- 每人每天一条记录
);

create index if not exists records_date_idx on public.records (date);

-- 3) 初始两位成员（未绑定账号，登录后各自认领）
insert into public.profiles (id, name) values
  ('lin', '林诺娅'),
  ('zhou', '钟滨')
on conflict (id) do nothing;

-- 4) 行级安全（RLS）策略
alter table public.profiles enable row level security;
alter table public.records enable row level security;

-- profiles：登录用户可读全部；只有本人或尚未被认领时可写入
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles claim or self update" on public.profiles;
create policy "profiles claim or self update" on public.profiles
  for update
  using (user_id is null or user_id = auth.uid())
  with check (user_id = auth.uid());

-- records：登录用户可读全部；只能增/改/删自己档案的记录
drop policy if exists "records readable" on public.records;
create policy "records readable" on public.records
  for select using (auth.role() = 'authenticated');

drop policy if exists "records insert own" on public.records;
create policy "records insert own" on public.records
  for insert with check (
    auth.uid() = (select user_id from public.profiles where id = profile_id)
  );

drop policy if exists "records update own" on public.records;
create policy "records update own" on public.records
  for update using (
    auth.uid() = (select user_id from public.profiles where id = profile_id)
  );

drop policy if exists "records delete own" on public.records;
create policy "records delete own" on public.records
  for delete using (
    auth.uid() = (select user_id from public.profiles where id = profile_id)
  );

-- 5) 开启 records 表的实时订阅（Realtime），用于双人数据自动同步
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;
