-- Выполнить в Supabase SQL Editor: привязка Google-аккаунта для входа и восстановления доступа

alter table users add column if not exists google_sub text unique;
alter table users add column if not exists google_email text;
