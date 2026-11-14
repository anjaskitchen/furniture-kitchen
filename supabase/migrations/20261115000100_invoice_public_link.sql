-- Link invoice publik untuk konsumen (dikirim lewat WhatsApp).
-- Token acak 128-bit: hanya pemegang link yang bisa membuka invoice; tidak bisa ditebak dari nomor order.
alter table public.orders add column if not exists public_token uuid not null default gen_random_uuid();
create unique index if not exists orders_public_token_uidx on public.orders (public_token);
