create table if not exists private.lesson_import_requests (
  request_id uuid primary key,
  payload_hash text not null,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on table private.lesson_import_requests from public, anon, authenticated;

create or replace function public.admin_save_lesson_package(
  p_lesson_id uuid,
  p_day_number integer,
  p_title text,
  p_description text,
  p_video_url text,
  p_content_md text,
  p_homework_md text,
  p_blocks jsonb
)
returns uuid
language plpgsql
set search_path = public, private, pg_temp
as $function$
declare
  block_item jsonb;
  block_id uuid;
  block_position integer := 0;
  position_offset integer;
  incoming_ids uuid[] := '{}'::uuid[];
begin
  if not private.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Only administrators can save lessons' using errcode = '42501';
  end if;

  if p_lesson_id is null
    or p_day_number is null
    or p_day_number < 1
    or coalesce(btrim(p_title), '') = ''
    or jsonb_typeof(p_blocks) is distinct from 'array' then
    raise exception 'Invalid lesson payload';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_lesson_id::text, 1));

  update public.lessons
  set day_number = p_day_number,
      title = p_title,
      description = coalesce(p_description, ''),
      video_url = nullif(p_video_url, ''),
      content_md = coalesce(p_content_md, ''),
      homework_md = coalesce(p_homework_md, '')
  where id = p_lesson_id;

  if not found then
    insert into public.lessons (
      id, day_number, title, description, video_url, content_md, homework_md
    ) values (
      p_lesson_id, p_day_number, p_title, coalesce(p_description, ''),
      nullif(p_video_url, ''), coalesce(p_content_md, ''), coalesce(p_homework_md, '')
    );
  end if;

  for block_item in select value from jsonb_array_elements(p_blocks)
  loop
    if jsonb_typeof(block_item) <> 'object'
      or coalesce(block_item->>'block_type', '') = ''
      or jsonb_typeof(coalesce(block_item->'content', '{}'::jsonb)) <> 'object'
      or coalesce(block_item->>'id', '') = '' then
      raise exception 'Invalid block payload at position %', block_position + 1;
    end if;

    block_id := (block_item->>'id')::uuid;
    if block_id = any(incoming_ids) then
      raise exception 'Duplicate block ID at position %', block_position + 1;
    end if;
    if exists (
      select 1 from public.lesson_blocks
      where id = block_id and lesson_id <> p_lesson_id
    ) then
      raise exception 'Block ID belongs to another lesson';
    end if;
    incoming_ids := array_append(incoming_ids, block_id);
    block_position := block_position + 1;
  end loop;

  -- Move all current positions out of the way before assigning the new order;
  -- this keeps the unique (lesson_id, position) index valid during reordering.
  select greatest(coalesce(max(position), 0), 0) + 1
  into position_offset
  from public.lesson_blocks
  where lesson_id = p_lesson_id;

  update public.lesson_blocks
  set position = position + position_offset
  where lesson_id = p_lesson_id;

  block_position := 0;
  for block_item in select value from jsonb_array_elements(p_blocks)
  loop
    block_id := (block_item->>'id')::uuid;
    update public.lesson_blocks
    set block_type = block_item->>'block_type',
        content = coalesce(block_item->'content', '{}'::jsonb),
        position = block_position
    where id = block_id and lesson_id = p_lesson_id;

    if not found then
      insert into public.lesson_blocks (id, lesson_id, block_type, position, content)
      values (
        block_id, p_lesson_id, block_item->>'block_type', block_position,
        coalesce(block_item->'content', '{}'::jsonb)
      );
    end if;
    block_position := block_position + 1;
  end loop;

  delete from public.lesson_blocks
  where lesson_id = p_lesson_id and not (id = any(incoming_ids));

  return p_lesson_id;
end;
$function$;

revoke all on function public.admin_save_lesson_package(uuid, integer, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.admin_save_lesson_package(uuid, integer, text, text, text, text, text, jsonb) to authenticated;

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
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  request_hash text;
  saved_hash text;
  saved_lesson_id uuid;
begin
  if not private.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Only administrators can import lessons' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'An import request ID is required';
  end if;

  request_hash := md5(jsonb_build_object(
    'mode', p_mode,
    'existing_lesson_id', p_existing_lesson_id,
    'day_number', p_day_number,
    'title', p_title,
    'description', p_description,
    'video_url', p_video_url,
    'content_md', p_content_md,
    'homework_md', p_homework_md,
    'blocks', p_blocks
  )::text);

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  select payload_hash, lesson_id
  into saved_hash, saved_lesson_id
  from private.lesson_import_requests
  where request_id = p_request_id;

  if found then
    if saved_hash <> request_hash then
      raise exception 'Import request ID was reused with different content';
    end if;
    return saved_lesson_id;
  end if;

  saved_lesson_id := public.admin_import_lesson_package(
    p_mode, p_existing_lesson_id, p_day_number, p_title, p_description,
    p_video_url, p_content_md, p_homework_md, p_blocks
  );

  insert into private.lesson_import_requests (request_id, payload_hash, lesson_id)
  values (p_request_id, request_hash, saved_lesson_id);

  return saved_lesson_id;
end;
$function$;

revoke all on function public.admin_import_lesson_package_once(uuid, text, uuid, integer, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.admin_import_lesson_package_once(uuid, text, uuid, integer, text, text, text, text, text, jsonb) to authenticated;
