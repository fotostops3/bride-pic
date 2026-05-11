-- Correlo en Supabase → SQL Editor

create table if not exists accounts (
  id               uuid default gen_random_uuid() primary key,
  account_key      text unique not null,
  name             text,
  credits          integer default 0 not null,
  total_generated  integer default 0 not null,
  created_at       timestamptz default now()
);

-- Crear la primera cuenta (tu cliente de prueba)
-- Cambiá el account_key y name según corresponda
insert into accounts (account_key, name, credits)
values ('CLIENTE-ROPA-001', 'Cliente Ropa Urbana', 20)
on conflict (account_key) do nothing;

-- Para agregar créditos manualmente (cuando te pagan):
-- update accounts set credits = credits + 50 where account_key = 'CLIENTE-ROPA-001';

-- Para ver el estado de todas las cuentas:
-- select name, credits, total_generated, created_at from accounts order by created_at;
