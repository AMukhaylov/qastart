-- Allow editable guide blocks in the lesson builder.

alter table public.lesson_blocks drop constraint if exists lesson_blocks_block_type_check;
alter table public.lesson_blocks add constraint lesson_blocks_block_type_check check (block_type in (
  'heading', 'text', 'definition', 'important', 'guide', 'example', 'diagram', 'image',
  'video', 'question', 'reflection', 'visual_choice', 'code', 'summary', 'homework'
));
