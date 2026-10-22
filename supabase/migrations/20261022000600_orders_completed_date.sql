-- save_order: tanggal selesai bisa diisi manual (untuk input order lama).
-- Jika status Selesai dan tanggal kosong, trigger mengisi hari ini.
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
      discount, additional_fee, cost_estimate, due_date, completed_at, survey_request_id, contact_message_id, notes
    ) values (
      coalesce(nullif(p ->> 'order_date', '')::date, public.jakarta_today()),
      p ->> 'customer_name', nullif(p ->> 'customer_phone', ''), nullif(p ->> 'customer_email', ''), nullif(p ->> 'customer_address', ''),
      p ->> 'title', nullif(p ->> 'category', ''), coalesce(nullif(p ->> 'source', ''), 'whatsapp'), coalesce(nullif(p ->> 'status', ''), 'confirmed'),
      coalesce((p ->> 'discount')::numeric, 0), coalesce((p ->> 'additional_fee')::numeric, 0), coalesce((p ->> 'cost_estimate')::numeric, 0),
      nullif(p ->> 'due_date', '')::date, nullif(p ->> 'completed_at', '')::date, nullif(p ->> 'survey_request_id', '')::uuid, nullif(p ->> 'contact_message_id', '')::uuid, nullif(p ->> 'notes', '')
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
      notes = nullif(p ->> 'notes', '')
    where id = v_id;
    if not found then
      raise exception 'Order tidak ditemukan atau tidak punya akses';
    end if;
  end if;

  delete from public.order_items where order_id = v_id;
  insert into public.order_items (order_id, name, description, qty, unit, unit_price, sort_order)
  select v_id, x ->> 'name', nullif(x ->> 'description', ''), (x ->> 'qty')::numeric, coalesce(nullif(x ->> 'unit', ''), 'unit'),
         (x ->> 'unit_price')::numeric, ord::int
  from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) with ordinality as t(x, ord);

  delete from public.order_payments where order_id = v_id;
  insert into public.order_payments (order_id, paid_at, amount, method, kind, reference, note)
  select v_id, coalesce(nullif(x ->> 'paid_at', '')::date, public.jakarta_today()), (x ->> 'amount')::numeric,
         coalesce(nullif(x ->> 'method', ''), 'transfer'), coalesce(nullif(x ->> 'kind', ''), 'dp'),
         nullif(x ->> 'reference', ''), nullif(x ->> 'note', '')
  from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) as t(x);

  perform public.recalc_order_totals(v_id);
  return v_id;
end;
$$;

