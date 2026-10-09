-- meeting_groups is only an opaque link table; exposing its ids avoids an RLS
-- recursion when course_meetings checks the dynamic audience.
drop policy if exists "Students can view published meeting groups" on public.meeting_groups;
create policy "Students can view meeting group links" on public.meeting_groups
  for select to authenticated
  using (true);
