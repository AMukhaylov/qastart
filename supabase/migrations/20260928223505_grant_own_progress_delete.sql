-- The DELETE policies added for self-service progress resets are ineffective
-- unless authenticated also has table-level DELETE privileges. RLS still limits
-- each delete to rows owned by auth.uid().
grant delete on public.lesson_progress to authenticated;
grant delete on public.lesson_block_progress to authenticated;

notify pgrst, 'reload schema';
