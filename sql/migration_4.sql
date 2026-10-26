-- Избранные пулы ликвидности (вкладка Pool)
create table if not exists pool_favorites (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  network text not null,          -- id сети GeckoTerminal: eth, bsc, arbitrum, base, solana
  address text not null,          -- адрес пула
  pool_name text,                 -- например "ELIZAOS / SOL" (запасное значение, если API недоступен)
  dex text,                       -- например "Raydium"
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, network, address)
);
create index if not exists idx_pool_favorites_user on pool_favorites(user_id, sort_order);
