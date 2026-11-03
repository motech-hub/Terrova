-- Opérations atomiques de crédits utilisées par les routes et les Workflows.

create or replace function public.reserve_credits(
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
  insert into public.credit_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  if exists (
    select 1 from public.credit_ledger
    where user_id = p_user_id and entry_type = 'reservation' and reference_id = p_reference_id
  ) then
    select * into wallet from public.credit_wallets where user_id = p_user_id;
    return wallet;
  end if;

  update public.credit_wallets
  set balance = balance - p_amount,
      reserved = reserved + p_amount,
      updated_at = now()
  where user_id = p_user_id and balance >= p_amount
  returning * into wallet;

  if not found then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.credit_ledger (user_id, entry_type, amount, reference_id)
  values (p_user_id, 'reservation', p_amount, p_reference_id);

  return wallet;
end;
$$;

create or replace function public.consume_reserved_credits(
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
  if not exists (
    select 1 from public.credit_ledger
    where user_id = p_user_id and entry_type = 'consumption' and reference_id = p_reference_id
  ) then
    update public.credit_wallets
    set reserved = reserved - p_amount,
        updated_at = now()
    where user_id = p_user_id and reserved >= p_amount
    returning * into wallet;

    if found then
      insert into public.credit_ledger (user_id, entry_type, amount, reference_id)
      values (p_user_id, 'consumption', p_amount, p_reference_id);
    end if;
  else
    select * into wallet from public.credit_wallets where user_id = p_user_id;
  end if;

  return wallet;
end;
$$;

create or replace function public.release_reserved_credits(
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
  if not exists (
    select 1 from public.credit_ledger
    where user_id = p_user_id and entry_type = 'release' and reference_id = p_reference_id
  ) then
    update public.credit_wallets
    set balance = balance + p_amount,
        reserved = reserved - p_amount,
        updated_at = now()
    where user_id = p_user_id and reserved >= p_amount
    returning * into wallet;

    if found then
      insert into public.credit_ledger (user_id, entry_type, amount, reference_id)
      values (p_user_id, 'release', p_amount, p_reference_id);
    end if;
  else
    select * into wallet from public.credit_wallets where user_id = p_user_id;
  end if;

  return wallet;
end;
$$;

revoke all on function public.reserve_credits(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.consume_reserved_credits(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.release_reserved_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.reserve_credits(uuid, integer, text) to service_role;
grant execute on function public.consume_reserved_credits(uuid, integer, text) to service_role;
grant execute on function public.release_reserved_credits(uuid, integer, text) to service_role;
