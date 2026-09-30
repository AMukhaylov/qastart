-- Store the hand-tuned layout for the Day 6 example. Existing state_diagram
-- blocks remain compatible when position/id fields are absent.
update public.lesson_blocks as block
set content = jsonb_build_object(
  'title', 'Пример жизненного цикла заказа',
  'states', jsonb_build_array(
    jsonb_build_object('id', 'created', 'label', 'Создан', 'position', jsonb_build_object('x', 80, 'y', 240)),
    jsonb_build_object('id', 'paid', 'label', 'Оплачен', 'position', jsonb_build_object('x', 360, 'y', 240)),
    jsonb_build_object('id', 'delivery', 'label', 'Передан в доставку', 'position', jsonb_build_object('x', 660, 'y', 240)),
    jsonb_build_object('id', 'delivered', 'label', 'Доставлен', 'position', jsonb_build_object('x', 980, 'y', 240)),
    jsonb_build_object('id', 'cancelled', 'label', 'Отменён', 'position', jsonb_build_object('x', 360, 'y', 60))
  ),
  'transitions', jsonb_build_array(
    jsonb_build_object('id', 'created-paid', 'from', 'created', 'to', 'paid', 'label', 'Оплата прошла', 'edgeType', 'smoothstep'),
    jsonb_build_object('id', 'created-cancelled', 'from', 'created', 'to', 'cancelled', 'label', 'Заказ отменён', 'edgeType', 'smoothstep'),
    jsonb_build_object('id', 'paid-delivery', 'from', 'paid', 'to', 'delivery', 'label', 'Заказ передан курьеру', 'edgeType', 'smoothstep'),
    jsonb_build_object('id', 'delivery-delivered', 'from', 'delivery', 'to', 'delivered', 'label', 'Заказ получен', 'edgeType', 'smoothstep')
  ),
  'initialState', 'created',
  'finalStates', jsonb_build_array('delivered', 'cancelled')
)
from public.lessons as lesson
where block.lesson_id = lesson.id
  and lesson.day_number = 6
  and block.block_type = 'state_diagram'
  and block.content->>'title' = 'Пример жизненного цикла заказа';
