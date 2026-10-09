-- The restored project retained RLS policies but was missing several API grants.
-- Keep data authorization in the existing policies; this only enables those policy paths.
grant usage on schema public to authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update on public.user_roles to authenticated;
grant insert, update on public.lesson_progress to authenticated;
grant insert on public.homework_submissions to authenticated;
grant insert, update, delete on public.certificates to authenticated;
grant insert, update, delete on public.course_meetings to authenticated;
