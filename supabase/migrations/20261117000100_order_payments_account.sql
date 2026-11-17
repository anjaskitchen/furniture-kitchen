-- =====================================================================
-- Perbaikan integritas pembayaran order & buku kas:
--   1. sync_ledger: update baris buku kas yang sudah ada tanpa memicu
--      INSERT baru (mencegah nomor transaksi TRX-YYMM-xxxxx loncat
--      dan mencegah log audit duplikat saat tidak ada perubahan nilai).
--   2. save_order: pertahankan id & account_id pada order_payments
--      (update berdasarkan id, bukan hapus-buat ulang semua pembayaran).
-- =====================================================================

create or replace function public.sync_ledger(
  p_source_type text, p_source_id uuid, p_active boolean,
  p_date date, p_account uuid, p_direction text, p_amount numeric, p_category text,
  p_project uuid, p_order uuid, p_description text, p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not p_active or coalesce(p_amount, 0) <= 0 then
    delete from public.financial_transactions where source_type = p_source_type and source_id = p_source_id;
    return;
  end if;
  if p_account is null then
    raise exception 'Belum ada akun kas aktif. Tambahkan akun di menu Keuangan → Akun Kas.';
  end if;

  -- Jika baris buku kas untuk sumber ini sudah ada, perbarui hanya bila ada perubahan nilai
  -- agar tidak memicu BEFORE INSERT trigger (next_doc_number / txn_seq).
  if exists (
    select 1 from public.financial_transactions
    where source_type = p_source_type and source_id = p_source_id and source_id is not null and source_type <> 'transfer'
  ) then
    update public.financial_transactions set
      txn_date = p_date,
      account_id = p_account,
      direction = p_direction,
      amount = p_amount,
      category = p_category,
      project_id = p_project,
      order_id = p_order,
      description = p_description,
      reference = p_reference
    where source_type = p_source_type
      and source_id = p_source_id
      and (txn_date, account_id, direction, amount, category, project_id, order_id, description, reference)
          is distinct from (p_date, p_account, p_direction, p_amount, p_category, p_project, p_order, p_description, p_reference);
    return;
  end if;

  insert into public.financial_transactions (txn_date, account_id, direction, amount, category, project_id, order_id, source_type, source_id, description, reference)
  values (p_date, p_account, p_direction, p_amount, p_category, p_project, p_order, p_source_type, p_source_id, p_description, p_reference)
  on conflict (source_type, source_id) where source_id is not null and source_type <> 'transfer'
  do update set txn_date = excluded.txn_date, account_id = excluded.account_id, direction = excluded.direction,
    amount = excluded.amount, category = excluded.category, project_id = excluded.project_id, order_id = excluded.order_id,
    description = excluded.description, reference = excluded.reference;
end;
$$;

revoke all on function public.sync_ledger(text, uuid, boolean, date, uuid, text, numeric, text, uuid, uuid, text, text) from public, anon, authenticated;

create or replace function public.save_order(p jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_id is null then
    insert into public.orders (
      order_date, customer_name, customer_phone, customer_email, customer_address, title, category, source, status,
      discount, additional_fee, cost_estimate, due_date, completed_at, survey_request_id, contact_message_id, notes,
      work_duration, work_duration_unit, work_start_date, invoice_notes
    ) values (
      coalesce(nullif(p ->> 'order_date', '')::date, public.jakarta_today()),
      p ->> 'customer_name', nullif(p ->> 'customer_phone', ''), nullif(p ->> 'customer_email', ''), nullif(p ->> 'customer_address', ''),
      p ->> 'title', nullif(p ->> 'category', ''), coalesce(nullif(p ->> 'source', ''), 'whatsapp'), coalesce(nullif(p ->> 'status', ''), 'confirmed'),
      coalesce((p ->> 'discount')::numeric, 0), coalesce((p ->> 'additional_fee')::numeric, 0), coalesce((p ->> 'cost_estimate')::numeric, 0),
      nullif(p ->> 'due_date', '')::date, nullif(p ->> 'completed_at', '')::date, nullif(p ->> 'survey_request_id', '')::uuid, nullif(p ->> 'contact_message_id', '')::uuid, nullif(p ->> 'notes', ''),
      nullif(p ->> 'work_duration', '')::int, coalesce(nullif(p ->> 'work_duration_unit', ''), 'work_days'), nullif(p ->> 'work_start_date', '')::date, nullif(p ->> 'invoice_notes', '')
    )
    returning id into v_id;
  else
    update public.orders set
      order_date = coalesce(nullif(p ->> 'order_date', '')::date, order_date),
      customer_name = p ->> 'customer_name',
      customer_phone = nullif(p ->> 'customer_phone', ''),
      customer_email = nullif(p ->> 'customer_email', ''),
      customer_address = nullif(p ->> 'customer_address', ''),
      title = p ->> 'title',
      category = nullif(p ->> 'category', ''),
      source = coalesce(nullif(p ->> 'source', ''), source),
      status = coalesce(nullif(p ->> 'status', ''), status),
      discount = coalesce((p ->> 'discount')::numeric, 0),
      additional_fee = coalesce((p ->> 'additional_fee')::numeric, 0),
      cost_estimate = coalesce((p ->> 'cost_estimate')::numeric, 0),
      due_date = nullif(p ->> 'due_date', '')::date,
      completed_at = nullif(p ->> 'completed_at', '')::date,
      notes = nullif(p ->> 'notes', ''),
      work_duration = nullif(p ->> 'work_duration', '')::int,
      work_duration_unit = coalesce(nullif(p ->> 'work_duration_unit', ''), 'work_days'),
      work_start_date = nullif(p ->> 'work_start_date', '')::date,
      invoice_notes = nullif(p ->> 'invoice_notes', '')
    where id = v_id;
    if not found then
      raise exception 'Order tidak ditemukan atau tidak punya akses';
    end if;
  end if;

  -- Item yang tidak ada lagi di form → hapus (rincian HPP-nya ikut terhapus).
  delete from public.order_items oi
  where oi.order_id = v_id
    and oi.id not in (
      select nullif(x ->> 'id', '')::uuid
      from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) as t(x)
      where nullif(x ->> 'id', '') is not null
    );

  -- Item lama → update; item baru → insert.
  with src as (
    select nullif(x ->> 'id', '')::uuid as id, x ->> 'name' as name, nullif(x ->> 'description', '') as description,
           case when nullif(x ->> 'length_m', '') is not null and nullif(x ->> 'height_m', '') is not null
                then round((x ->> 'length_m')::numeric * (x ->> 'height_m')::numeric, 2)
                else (x ->> 'qty')::numeric end as qty,
           case when nullif(x ->> 'length_m', '') is not null and nullif(x ->> 'height_m', '') is not null then 'm²'
                else coalesce(nullif(x ->> 'unit', ''), 'unit') end as unit,
           (x ->> 'unit_price')::numeric as unit_price, ord::int as sort_order,
           nullif(x ->> 'length_m', '')::numeric as length_m, nullif(x ->> 'height_m', '')::numeric as height_m
    from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) with ordinality as t(x, ord)
  ),
  upd as (
    update public.order_items oi set
      name = s.name, description = s.description, qty = s.qty, unit = s.unit, unit_price = s.unit_price,
      sort_order = s.sort_order, length_m = s.length_m, height_m = s.height_m
    from src s
    where s.id is not null and oi.id = s.id and oi.order_id = v_id
    returning oi.id
  )
  insert into public.order_items (order_id, name, description, qty, unit, unit_price, sort_order, length_m, height_m)
  select v_id, s.name, s.description, s.qty, s.unit, s.unit_price, s.sort_order, s.length_m, s.height_m
  from src s
  where s.id is null or not exists (select 1 from upd u where u.id = s.id);

  -- Pembayaran yang dihapus dari form → hapus (baris buku kas ikut dihapus trigger).
  delete from public.order_payments op
  where op.order_id = v_id
    and op.id not in (
      select nullif(x ->> 'id', '')::uuid
      from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) as t(x)
      where nullif(x ->> 'id', '') is not null
    );

  -- Pembayaran lama → update (mempertahankan id & account_id); pembayaran baru → insert.
  with psrc as (
    select nullif(x ->> 'id', '')::uuid as id,
           coalesce(nullif(x ->> 'paid_at', '')::date, public.jakarta_today()) as paid_at,
           (x ->> 'amount')::numeric as amount,
           coalesce(nullif(x ->> 'method', ''), 'transfer') as method,
           coalesce(nullif(x ->> 'kind', ''), 'dp') as kind,
           nullif(x ->> 'reference', '') as reference,
           nullif(x ->> 'note', '') as note,
           (x ? 'account_id') as has_account,
           nullif(x ->> 'account_id', '')::uuid as account_id
    from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) as t(x)
  ),
  pupd as (
    update public.order_payments op set
      paid_at = s.paid_at,
      amount = s.amount,
      method = s.method,
      kind = s.kind,
      reference = s.reference,
      note = s.note,
      account_id = case when s.has_account then s.account_id else op.account_id end
    from psrc s
    where s.id is not null and op.id = s.id and op.order_id = v_id
    returning op.id
  )
  insert into public.order_payments (order_id, paid_at, amount, method, kind, reference, note, account_id)
  select v_id, s.paid_at, s.amount, s.method, s.kind, s.reference, s.note, s.account_id
  from psrc s
  where s.id is null or not exists (select 1 from pupd u where u.id = s.id);

  perform public.recalc_order_totals(v_id);
  perform public.recalc_order_hpp(v_id);
  return v_id;
end;
$$;
