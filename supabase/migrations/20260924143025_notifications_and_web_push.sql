create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (
    type in (
      'homework_approved',
      'homework_rework',
      'homework_mentor_comment',
      'homework_submitted',
      'homework_resubmitted'
    )
  ),
  title text not null,
  body text not null default '',
  link text not null,
  metadata jsonb not null default '{}'::jsonb,
  event_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_unread_created_idx
  on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "Recipients can read their notifications"
  on public.notifications
  for select
  to authenticated
  using ((select auth.uid()) = recipient_user_id);

create policy "Recipients can mark their notifications read"
  on public.notifications
  for update
  to authenticated
  using ((select auth.uid()) = recipient_user_id)
  with check ((select auth.uid()) = recipient_user_id);

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index web_push_subscriptions_user_idx on public.web_push_subscriptions (user_id);

alter table public.web_push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
  on public.web_push_subscriptions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.web_push_subscriptions to authenticated;
grant all on public.web_push_subscriptions to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
