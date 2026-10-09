-- Remove the duplicate expanded copy accidentally left after an editor save.
-- Keep the canonical Day 1 sequence at positions 0..37.
do $$
declare
  lesson_uuid uuid;
begin
  select id into lesson_uuid from public.lessons where day_number = 1;
  if lesson_uuid is null then
    raise exception 'Day 1 is missing';
  end if;

  delete from public.lesson_blocks
  where lesson_id = lesson_uuid
    and position >= 100000;
end;
$$;
