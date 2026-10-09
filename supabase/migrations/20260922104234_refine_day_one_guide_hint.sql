-- Make the expected-vs-actual guide a practical hint rather than a duplicate transition.
do $$
declare
  lesson_uuid uuid;
begin
  select id into lesson_uuid from public.lessons where day_number = 1;
  if lesson_uuid is null then
    raise exception 'Day 1 is missing';
  end if;

  update public.lesson_blocks
  set content = jsonb_build_object(
    'title', 'На что смотреть в примере',
    'text', 'Сначала сформулируй, что должно произойти по правилу. Затем посмотри, что увидел пользователь после своих действий. Если результаты расходятся, это сигнал для дальнейшей проверки. В следующем блоке сравним их на примере входа.',
    'variant', 'explain',
    'visible', true,
    'required', false,
    'blocksNext', false
  )
  where lesson_id = lesson_uuid
    and position = 1150
    and block_type = 'guide';
end $$;
