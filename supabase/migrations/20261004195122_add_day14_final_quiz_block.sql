-- Store the existing final exam as an ordinary, reorderable lesson block.
alter table public.lesson_blocks drop constraint if exists lesson_blocks_block_type_check;
alter table public.lesson_blocks add constraint lesson_blocks_block_type_check check (block_type in (
  'heading', 'text', 'definition', 'important', 'guide', 'example', 'diagram',
  'state_diagram', 'table', 'image', 'video', 'question', 'reflection',
  'visual_choice', 'code', 'summary', 'final_quiz', 'homework'
));

-- Preserve the existing Day 14 lesson content and append its quiz at the end.
insert into public.lesson_blocks (lesson_id, block_type, position, content)
select lesson.id, 'final_quiz', coalesce(max(block.position) + 1, 0), '{}'::jsonb
from public.lessons as lesson
left join public.lesson_blocks as block on block.lesson_id = lesson.id
where lesson.day_number = 14
  and not exists (
    select 1 from public.lesson_blocks as quiz
    where quiz.lesson_id = lesson.id and quiz.block_type = 'final_quiz'
  )
group by lesson.id;
