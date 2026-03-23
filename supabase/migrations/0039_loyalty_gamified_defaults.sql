alter table public.salon_loyalty_programs
alter column tier_one_name set default 'Bronze',
alter column tier_two_name set default 'Prata',
alter column vip_tier_name set default 'Ouro';

update public.salon_loyalty_programs
set tier_one_name = 'Bronze'
where btrim(coalesce(tier_one_name, '')) = 'Cliente Frequente'
  and tier_one_min_visits = 3
  and tier_one_discount_percent = 5;

update public.salon_loyalty_programs
set tier_two_name = 'Prata'
where btrim(coalesce(tier_two_name, '')) = 'Cliente Ouro'
  and tier_two_min_visits = 6
  and tier_two_discount_percent = 10;

update public.salon_loyalty_programs
set vip_tier_name = 'Ouro'
where btrim(coalesce(vip_tier_name, '')) = 'Cliente VIP'
  and vip_min_visits = 10
  and vip_discount_percent = 15;
