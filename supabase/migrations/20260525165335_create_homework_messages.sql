create table if not exists public.homework_messages (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.homework_submissions(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('student', 'mentor')),
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists homework_messages_submission_created_idx
  on public.homework_messages (submission_id, created_at);

alter table public.homework_messages enable row level security;

drop policy if exists "Students can read their homework messages" on public.homework_messages;
create policy "Students can read their homework messages"
  on public.homework_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.homework_submissions hs
      where hs.id = homework_messages.submission_id
        and hs.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read all homework messages" on public.homework_messages;
create policy "Admins can read all homework messages"
  on public.homework_messages
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

grant select on public.homework_messages to authenticated;
grant select, insert, update, delete on public.homework_messages to service_role;

insert into public.homework_messages (submission_id, author_id, author_role, body, attachments, created_at)
select hs.id, hs.user_id, 'student', hs.content, '[]'::jsonb, hs.created_at
from public.homework_submissions hs
where hs.content is not null
  and hs.content <> ''
  and not exists (
    select 1
    from public.homework_messages hm
    where hm.submission_id = hs.id
      and hm.author_role = 'student'
      and hm.body = hs.content
  );

insert into public.homework_messages (submission_id, author_id, author_role, body, attachments, created_at)
select hs.id, hs.reviewed_by, 'mentor', hs.feedback, '[]'::jsonb, coalesce(hs.reviewed_at, hs.created_at)
from public.homework_submissions hs
where hs.feedback is not null
  and hs.feedback <> ''
  and not exists (
    select 1
    from public.homework_messages hm
    where hm.submission_id = hs.id
      and hm.author_role = 'mentor'
      and hm.body = hs.feedback
  );
