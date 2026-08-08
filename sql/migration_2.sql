-- Выполнить в Supabase SQL Editor (после уже применённого schema.sql)
-- Добавляет только поле сортировки. Telegram-уведомления пока не используются.

alter table pairs add column if not exists sort_order integer default 0;

-- проставим порядковые номера уже существующим парам по дате добавления
update pairs p set sort_order = t.rn
from (
  select id, row_number() over (partition by user_id order by created_at) as rn
  from pairs
) t
where p.id = t.id and p.sort_order = 0;
