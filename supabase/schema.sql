-- =============================================================
-- 双燃 Duo Fit · Supabase 初始化脚本
-- 用法：Supabase Dashboard → SQL Editor → 粘贴运行（可重复执行，幂等）
-- =============================================================

-- 1) 成员档案表：把登录账号绑定到两位成员之一
create table if not exists public.profiles (
  id text primary key,                                        -- 'lin' | 'zhou'
  user_id uuid references auth.users (id) on delete set null unique,
  name text not null,
  target_calories numeric not null default 1450,
  target_weight numeric not null default 52,
  start_weight numeric not null default 58.4,
  height numeric not null default 163,
  weekly_goal numeric not null default 4,
  created_at timestamptz not null default now()
);

-- 为旧项目升级：新增个人目标字段，兼容之前已建好的 profiles 表。
alter table public.profiles add column if not exists target_calories numeric not null default 1450;
alter table public.profiles add column if not exists target_weight numeric not null default 52;
alter table public.profiles add column if not exists start_weight numeric not null default 58.4;
alter table public.profiles add column if not exists height numeric not null default 163;
alter table public.profiles add column if not exists weekly_goal numeric not null default 4;

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
  ('lin', '小林'),
  ('zhou', '小钟')
on conflict (id) do nothing;

-- 保留旧成员已有设置，仅修正默认配置的姓名和标准目标值。
update public.profiles set
  name = case id when 'lin' then '小林' when 'zhou' then '小钟' else name end
where id in ('lin', 'zhou');

-- 新列首次添加时会套用公共默认值；仅将“尚未被用户调整”的周屿演示默认值改为小钟默认值。
update public.profiles set
  target_calories = 1850,
  target_weight = 70,
  start_weight = 77.2,
  height = 178
where id = 'zhou'
  and target_calories = 1450
  and target_weight = 52
  and start_weight = 58.4
  and height = 163;

-- 5) 共享活动历史（打卡、目标更新、清空等摘要事件）
create table if not exists public.activity_log (
  id text primary key,
  profile_id text references public.profiles (id) on delete set null,
  event_type text not null check (event_type in ('checkin', 'goal_update', 'reset')),
  record_date text,
  calories numeric,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);

-- 4) 行级安全（RLS）策略
alter table public.profiles enable row level security;
alter table public.records enable row level security;
alter table public.activity_log enable row level security;

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

drop policy if exists "activity log readable" on public.activity_log;
create policy "activity log readable" on public.activity_log
  for select using (auth.role() = 'authenticated');

drop policy if exists "activity log insert own" on public.activity_log;
create policy "activity log insert own" on public.activity_log
  for insert with check (
    profile_id is null or auth.uid() = (select user_id from public.profiles where id = profile_id)
  );

drop policy if exists "activity log delete own" on public.activity_log;
create policy "activity log delete own" on public.activity_log
  for delete using (
    profile_id is not null and auth.uid() = (select user_id from public.profiles where id = profile_id)
  );

-- 6) 开启表的实时订阅，用于双人数据自动同步
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_log'
  ) then
    alter publication supabase_realtime add table public.activity_log;
  end if;
end $$;
