-- Extend the existing lesson_blocks model with two visual content types.
-- No new content table is introduced: blocks continue to store their payload in JSONB.
alter table public.lesson_blocks drop constraint if exists lesson_blocks_block_type_check;
alter table public.lesson_blocks add constraint lesson_blocks_block_type_check check (block_type in (
  'heading', 'text', 'definition', 'important', 'guide', 'example', 'diagram',
  'state_diagram', 'table', 'image', 'video', 'question', 'reflection',
  'visual_choice', 'code', 'summary', 'homework'
));

-- Replace only the two examples requested in Day 6. All other lesson content stays untouched.
update public.lesson_blocks as block
set
  block_type = 'state_diagram',
  content = jsonb_build_object(
    'title', 'Пример жизненного цикла заказа',
    'states', jsonb_build_array(
      jsonb_build_object('id', 'created', 'label', 'Создан'),
      jsonb_build_object('id', 'paid', 'label', 'Оплачен'),
      jsonb_build_object('id', 'delivery', 'label', 'Передан в доставку'),
      jsonb_build_object('id', 'delivered', 'label', 'Доставлен'),
      jsonb_build_object('id', 'cancelled', 'label', 'Отменён')
    ),
    'transitions', jsonb_build_array(
      jsonb_build_object('from', 'created', 'to', 'paid', 'label', 'Оплата прошла'),
      jsonb_build_object('from', 'created', 'to', 'cancelled', 'label', 'Заказ отменён'),
      jsonb_build_object('from', 'paid', 'to', 'delivery', 'label', 'Заказ передан курьеру'),
      jsonb_build_object('from', 'delivery', 'to', 'delivered', 'label', 'Заказ получен')
    ),
    'initialState', 'created',
    'finalStates', jsonb_build_array('delivered', 'cancelled')
  )
from public.lessons as lesson
where block.lesson_id = lesson.id
  and lesson.day_number = 6
  and block.block_type = 'diagram'
  and block.content->>'title' = 'Пример жизненного цикла заказа';

update public.lesson_blocks as block
set
  block_type = 'table',
  content = jsonb_build_object(
    'title', 'Таблица принятия решений',
    'columns', jsonb_build_array(
      jsonb_build_object('id', 'amount', 'label', 'Сумма заказа ≥ 5 000 ₽'),
      jsonb_build_object('id', 'loyalty', 'label', 'Программа лояльности'),
      jsonb_build_object('id', 'delivery', 'label', 'Доставка')
    ),
    'rows', jsonb_build_array(
      jsonb_build_object('amount', 'Да', 'loyalty', 'Да', 'delivery', 'Бесплатная'),
      jsonb_build_object('amount', 'Да', 'loyalty', 'Нет', 'delivery', 'Платная'),
      jsonb_build_object('amount', 'Нет', 'loyalty', 'Да', 'delivery', 'Платная'),
      jsonb_build_object('amount', 'Нет', 'loyalty', 'Нет', 'delivery', 'Платная')
    )
  )
from public.lessons as lesson
where block.lesson_id = lesson.id
  and lesson.day_number = 6
  and block.block_type = 'example'
  and block.content->>'title' = 'Бесплатная доставка';
