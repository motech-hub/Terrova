-- Commandes et paiements PayDunya. Les écritures sont faites uniquement par le serveur.

create table if not exists public.orders (
  order_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_type text not null check (product_type in ('plan', 'pack')),
  product_id text not null,
  product_name text not null,
  credits integer not null check (credits > 0),
  amount_xof integer not null check (amount_xof > 0),
  currency text not null default 'XOF',
  provider text not null check (provider in ('paydunya', 'stripe')),
  status text not null check (status in ('pending', 'completed', 'cancelled', 'failed')),
  provider_token text,
  checkout_url text,
  provider_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists orders_provider_token_idx
  on public.orders(provider, provider_token)
  where provider_token is not null;
create index if not exists orders_user_id_idx on public.orders(user_id);

create table if not exists public.payments (
  payment_id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(order_id) on delete cascade,
  provider text not null,
  provider_token text not null,
  provider_transaction_id text,
  status text not null check (status in ('pending', 'completed', 'cancelled', 'failed')),
  amount_xof integer not null check (amount_xof > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_token)
);

create index if not exists payments_order_id_idx on public.payments(order_id);

alter table public.orders enable row level security;
alter table public.payments enable row level security;

drop policy if exists orders_own on public.orders;
create policy orders_own on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists payments_own on public.payments;
create policy payments_own on public.payments
  for select using (
    exists (
      select 1 from public.orders
      where orders.order_id = payments.order_id
        and orders.user_id = auth.uid()
    )
  );

create or replace function public.complete_paydunya_order(
  p_order_id text,
  p_provider_token text,
  p_status text,
  p_amount_xof integer,
  p_provider_transaction_id text default null
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  current_order public.orders;
begin
  if p_status not in ('pending', 'completed', 'cancelled', 'failed') then
    raise exception 'INVALID_PAYMENT_STATUS';
  end if;

  select * into current_order
  from public.orders
  where order_id = p_order_id
    and provider = 'paydunya'
    and provider_token = p_provider_token
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if current_order.amount_xof <> p_amount_xof then
    raise exception 'PAYMENT_AMOUNT_MISMATCH';
  end if;

  insert into public.payments (
    order_id, provider, provider_token, provider_transaction_id,
    status, amount_xof, updated_at
  ) values (
    current_order.order_id, 'paydunya', p_provider_token, p_provider_transaction_id,
    p_status, p_amount_xof, now()
  )
  on conflict (provider, provider_token) do update set
    provider_transaction_id = coalesce(excluded.provider_transaction_id, public.payments.provider_transaction_id),
    status = excluded.status,
    amount_xof = excluded.amount_xof,
    updated_at = now();

  if p_status = 'completed' then
    insert into public.credit_wallets (user_id)
    values (current_order.user_id)
    on conflict (user_id) do nothing;

    if not exists (
      select 1 from public.credit_ledger
      where user_id = current_order.user_id
        and entry_type = 'purchase'
        and reference_id = current_order.order_id
    ) then
      insert into public.credit_ledger (user_id, entry_type, amount, reference_id)
      values (current_order.user_id, 'purchase', current_order.credits, current_order.order_id);

      update public.credit_wallets
      set balance = balance + current_order.credits,
          updated_at = now()
      where user_id = current_order.user_id;
    end if;

    update public.orders
    set status = 'completed',
        provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where order_id = current_order.order_id;
  elsif current_order.status <> 'completed' then
    update public.orders
    set status = p_status,
        provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
        updated_at = now()
    where order_id = current_order.order_id;
  end if;

  select * into current_order from public.orders where public.orders.order_id = current_order.order_id;
  return current_order;
end;
$$;

revoke all on function public.complete_paydunya_order(text, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.complete_paydunya_order(text, text, text, integer, text)
  to service_role;

create or replace function public.grant_purchased_credits(
  p_user_id uuid,
  p_amount integer,
  p_reference_id text
)
returns public.credit_wallets
language plpgsql
security definer set search_path = public
as $$
declare
  wallet public.credit_wallets;
begin
  if p_amount <= 0 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  insert into public.credit_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  if not exists (
    select 1 from public.credit_ledger
    where user_id = p_user_id and entry_type = 'purchase' and reference_id = p_reference_id
  ) then
    insert into public.credit_ledger (user_id, entry_type, amount, reference_id)
    values (p_user_id, 'purchase', p_amount, p_reference_id);
    update public.credit_wallets
    set balance = balance + p_amount, updated_at = now()
    where user_id = p_user_id;
  end if;

  select * into wallet from public.credit_wallets where user_id = p_user_id;
  return wallet;
end;
$$;

revoke all on function public.grant_purchased_credits(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.grant_purchased_credits(uuid, integer, text)
  to service_role;
