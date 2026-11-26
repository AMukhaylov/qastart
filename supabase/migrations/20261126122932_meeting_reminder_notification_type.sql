alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type = any (
      array[
        'homework_approved',
        'homework_rework',
        'homework_mentor_comment',
        'homework_submitted',
        'homework_resubmitted',
        'course_application_submitted',
        'meeting_reminder'
      ]::text[]
    )
  );

notify pgrst, 'reload schema';
