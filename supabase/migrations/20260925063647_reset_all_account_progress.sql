-- Reset training state for every account without touching users, profiles,
-- roles, invitations, or notification history.
delete from public.certificates;
delete from public.quiz_attempts;
delete from public.homework_submissions;
delete from public.lesson_block_progress;
delete from public.lesson_progress;
