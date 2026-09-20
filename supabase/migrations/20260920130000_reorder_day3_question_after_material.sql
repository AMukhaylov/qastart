-- The first Day 3 check follows the full explanation of a test case.

do $$
declare
  day_three_id uuid;
  check_question_id uuid;
begin
  select id into day_three_id
  from public.lessons
  where day_number = 3;

  select id into check_question_id
  from public.lesson_blocks
  where lesson_id = day_three_id
    and block_type = 'question'
    and content->>'question' = 'Что обычно содержит тест-кейс?'
  limit 1;

  if check_question_id is not null and exists (
    select 1 from public.lesson_blocks
    where id = check_question_id and position <> 9
  ) then
    update public.lesson_blocks
    set position = position + 100
    where lesson_id = day_three_id and position >= 5;

    update public.lesson_blocks
    set position = 9
    where id = check_question_id;

    update public.lesson_blocks
    set position = position - 101
    where lesson_id = day_three_id and position between 106 and 109;

    update public.lesson_blocks
    set position = position - 100
    where lesson_id = day_three_id and position >= 110;
  end if;
end;
$$;
