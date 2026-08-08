-- Выполнить в Supabase SQL Editor (после уже применённого schema.sql)

alter table users add column if not exists telegram_chat_id text;

alter table pairs add column if not exists sort_order integer default 0;
alter table pairs add column if not exists alert_above numeric;
alter table pairs add column if not exists alert_below numeric;
alter table pairs add column if not exists last_alert_direction text; -- 'above' | 'below' | null

-- проставим порядковые номера уже существующим парам по дате добавления
update pairs p set sort_order = t.rn
from (
  select id, row_number() over (partition by user_id order by created_at) as rn
  from pairs
) t
where p.id = t.id and p.sort_order = 0;
