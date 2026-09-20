-- Practical homework is kept only for the lessons selected in the QA Start program.
-- The remaining lessons use checking tests when their interactive lesson blocks are prepared.

do $$
declare
  day_one_id uuid;
  greeting_video_id uuid;
begin
  select id into day_one_id
  from public.lessons
  where day_number = 1;

  select id into greeting_video_id
  from public.lesson_blocks
  where lesson_id = day_one_id
    and block_type = 'video'
    and content->>'title' = 'Приветствие Артура'
  limit 1;

  -- Put the greeting immediately after the “Давайте познакомимся” heading.
  if greeting_video_id is not null and exists (
    select 1
    from public.lesson_blocks
    where id = greeting_video_id
      and position <> 4
  ) then
    update public.lesson_blocks
    set position = position + 100
    where lesson_id = day_one_id
      and id <> greeting_video_id
      and position >= 2;

    update public.lesson_blocks
    set position = 4
    where id = greeting_video_id;

    update public.lesson_blocks
    set position = position - 101
    where lesson_id = day_one_id
      and position between 102 and 104;

    update public.lesson_blocks
    set position = position - 100
    where lesson_id = day_one_id
      and position >= 105;
  end if;
end;
$$;

-- Homework is part of the practice days only: 3, 4, 5, 6, 8, 10, 11 and 13.
-- Clearing the legacy text also removes the submission form from the remaining lessons.
update public.lessons
set homework_md = ''
where day_number not in (3, 4, 5, 6, 8, 10, 11, 13);
