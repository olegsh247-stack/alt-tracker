-- Выполнить в Supabase SQL Editor: хранилище переводов заголовков новостей
-- (каждый заголовок переводится один раз и запоминается — экономит дневной лимит бесплатного переводчика)

create table if not exists news_ru (
  link text primary key,
  title_ru text not null,
  created_at timestamptz default now()
);
alter table news_ru enable row level security;
