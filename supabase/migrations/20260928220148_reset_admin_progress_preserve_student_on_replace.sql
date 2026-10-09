-- Replacing lesson content restarts only the importing administrator's own
-- progress. Student lesson and block progress remain attached to this lesson.
-- Existing block IDs are reused by ordered position so block progress survives
-- JSON replacement even when the imported package does not contain database IDs.

drop policy if exists "Users delete own lesson progress" on public.lesson_progress;
create policy "Users delete own lesson progress"
  on public.lesson_progress
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users delete own block progress" on public.lesson_block_progress;
create policy "Users delete own block progress"
  on public.lesson_block_progress
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.admin_import_lesson_package(
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
security invoker
set search_path = public, pg_temp
as $$
declare
  target_lesson_id uuid;
  block_item jsonb;
  block_index integer;
  existing_block_ids uuid[] := '{}'::uuid[];
begin
  if not private.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Only administrators can import lessons' using errcode = '42501';
  end if;

  if p_mode not in ('create', 'replace') then
    raise exception 'Unsupported import mode: %', p_mode;
  end if;

  if p_day_number < 1 or coalesce(btrim(p_title), '') = '' or jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'Invalid lesson package payload';
  end if;

  if p_mode = 'replace' then
    if p_existing_lesson_id is null then
      raise exception 'An existing lesson is required for replace mode';
    end if;

    update public.lessons
    set day_number = p_day_number,
        title = p_title,
        description = coalesce(p_description, ''),
        video_url = nullif(p_video_url, ''),
        content_md = coalesce(p_content_md, ''),
        homework_md = coalesce(p_homework_md, '')
    where id = p_existing_lesson_id;

    if not found then
      raise exception 'Lesson to replace was not found';
    end if;
    target_lesson_id := p_existing_lesson_id;

    -- A replacement is a fresh run for the admin who performed it.
    delete from public.lesson_progress
    where user_id = (select auth.uid())
      and lesson_id = target_lesson_id;
    delete from public.lesson_block_progress
    where user_id = (select auth.uid())
      and lesson_id = target_lesson_id;

    -- Keep block IDs by prior display order so student completion marks survive.
    select coalesce(array_agg(id order by position), '{}'::uuid[])
    into existing_block_ids
    from public.lesson_blocks
    where lesson_id = target_lesson_id;

    -- Move old rows out of the way before assigning compact positions again.
    update public.lesson_blocks
    set position = position + 1000000
    where lesson_id = target_lesson_id;
  else
    insert into public.lessons (day_number, title, description, video_url, content_md, homework_md)
    values (
      p_day_number,
      p_title,
      coalesce(p_description, ''),
      nullif(p_video_url, ''),
      coalesce(p_content_md, ''),
      coalesce(p_homework_md, '')
    )
    returning id into target_lesson_id;
  end if;

  for block_item, block_index in
    select value, ordinal - 1
    from jsonb_array_elements(p_blocks) with ordinality
  loop
    if jsonb_typeof(block_item) <> 'object'
      or coalesce(block_item->>'block_type', '') = ''
      or jsonb_typeof(coalesce(block_item->'content', '{}'::jsonb)) <> 'object' then
      raise exception 'Invalid block payload at position %', block_index + 1;
    end if;

    if block_index < coalesce(array_length(existing_block_ids, 1), 0) then
      update public.lesson_blocks
      set block_type = block_item->>'block_type',
          position = block_index,
          content = coalesce(block_item->'content', '{}'::jsonb)
      where id = existing_block_ids[block_index + 1];
    else
      insert into public.lesson_blocks (lesson_id, block_type, position, content)
      values (
        target_lesson_id,
        block_item->>'block_type',
        block_index,
        coalesce(block_item->'content', '{}'::jsonb)
      );
    end if;
  end loop;

  -- Only blocks removed from the end of the imported ordered list are deleted.
  -- Their student marks are no longer meaningful because those blocks no longer exist.
  delete from public.lesson_blocks
  where lesson_id = target_lesson_id
    and position >= 1000000;

  return target_lesson_id;
end;
$$;

revoke all on function public.admin_import_lesson_package(text, uuid, integer, text, text, text, text, text, jsonb) from public;
grant execute on function public.admin_import_lesson_package(text, uuid, integer, text, text, text, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
