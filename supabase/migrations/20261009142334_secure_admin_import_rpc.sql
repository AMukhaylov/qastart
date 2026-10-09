-- Keep the Data API entry point invoker-secured. The implementation still
-- needs elevated access to the private idempotency ledger, so keep that
-- implementation in the non-exposed schema and retain its explicit admin
-- role check.
alter function public.admin_import_lesson_package_once(
  uuid, text, uuid, integer, text, text, text, text, text, jsonb
) set schema private;

alter function private.admin_import_lesson_package_once(
  uuid, text, uuid, integer, text, text, text, text, text, jsonb
) security definer;

alter function private.admin_import_lesson_package_once(
  uuid, text, uuid, integer, text, text, text, text, text, jsonb
) set search_path = '';

revoke all on function private.admin_import_lesson_package_once(
  uuid, text, uuid, integer, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function private.admin_import_lesson_package_once(
  uuid, text, uuid, integer, text, text, text, text, text, jsonb
) to authenticated;

create or replace function public.admin_import_lesson_package_once(
  p_request_id uuid,
  p_mode text,
  p_existing_lesson_id uuid,
  p_day_number integer,
  p_title text,
  p_description text,
  p_video_url text,
  p_content_md text,
  p_homework_md text,
  p_blocks jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.admin_import_lesson_package_once(
    p_request_id, p_mode, p_existing_lesson_id, p_day_number, p_title,
    p_description, p_video_url, p_content_md, p_homework_md, p_blocks
  );
$function$;

revoke all on function public.admin_import_lesson_package_once(
  uuid, text, uuid, integer, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.admin_import_lesson_package_once(
  uuid, text, uuid, integer, text, text, text, text, text, jsonb
) to authenticated;

notify pgrst, 'reload schema';
