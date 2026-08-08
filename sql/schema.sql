-- Выполнить этот файл в Supabase: Project -> SQL Editor -> New query -> вставить -> Run

create table if not exists users (
  id bigserial primary key,          -- 1, 2, 3... отсюда делаем логин 00000001
  login text generated always as (lpad(id::text, 8, '0')) stored unique,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists pairs (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  asset1 text not null,       -- напр. DOGE
  exchange1 text not null,    -- BINANCE / BYBIT / OKX
  asset2 text not null,       -- напр. LTC
  exchange2 text not null,
  created_at timestamptz default now()
);

create index if not exists idx_pairs_user on pairs(user_id);

-- Row Level Security: пользователь видит и может изменять только свои пары.
-- Так как авторизация у нас своя (не supabase auth), доступ к таблицам идёт
-- через серверный API (service role), который сам фильтрует по user_id,
-- поэтому RLS можно оставить выключенным для простоты личного проекта.
