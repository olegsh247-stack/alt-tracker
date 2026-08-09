-- Выполнить в Supabase SQL Editor

alter table pairs add column if not exists category text not null default 'crypto';
create index if not exists idx_pairs_category on pairs(user_id, category);
