alter table public.course_meetings
  add column if not exists recording_url text;

alter table public.course_meetings
  add constraint course_meetings_recording_url_https_check
  check (
    recording_url is null
    or (length(recording_url) <= 500 and recording_url ~* '^https://')
  );

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type = any (
      array[
        'homework_approved'::text,
        'homework_rework'::text,
        'homework_mentor_comment'::text,
        'homework_submitted'::text,
        'homework_resubmitted'::text,
        'course_application_submitted'::text
      ]
    )
  );
