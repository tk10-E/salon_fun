alter table public.customers
add column if not exists allergies text,
add column if not exists beauty_products text;
