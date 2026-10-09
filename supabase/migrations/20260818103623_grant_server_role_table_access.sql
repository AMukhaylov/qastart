-- Server functions use the service-role key to perform role checks and protected
-- mutations. The restored database was missing these table grants, which caused
-- authenticated flows to wait for retries and then fail.
grant usage on schema public to service_role;

grant select, insert, update, delete on table public.certificates to service_role;
grant select, insert, update, delete on table public.course_invites to service_role;
grant select, insert, update, delete on table public.course_meetings to service_role;
grant select, insert, update, delete on table public.homework_messages to service_role;
grant select, insert, update, delete on table public.homework_submissions to service_role;
grant select, insert, update, delete on table public.lesson_progress to service_role;
grant select, insert, update, delete on table public.lessons to service_role;
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.quiz_attempts to service_role;
grant select, insert, update, delete on table public.user_roles to service_role;

grant usage, select on all sequences in schema public to service_role;
