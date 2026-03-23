-- Verificacao pos deploy do lote 0037-0040.
-- Pode ser executado no SQL Editor do Supabase ou via API de query.

select version
from supabase_migrations.schema_migrations
where version in ('0037', '0038', '0039', '0040')
order by version;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'customers' and column_name in ('allergies', 'beauty_products'))
    or (table_name = 'staff_members' and column_name in ('commission_rate_percent', 'commission_flat_fee'))
    or (table_name = 'salon_loyalty_programs' and column_name in ('vip_reward_service_id', 'tier_one_name', 'tier_two_name', 'vip_tier_name'))
  )
order by table_name, column_name;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('inventory_products', 'inventory_movements')
order by table_name;

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'inventory_products_salon_idx',
    'inventory_products_low_stock_idx',
    'inventory_movements_salon_idx',
    'inventory_movements_product_idx',
    'salon_loyalty_programs_vip_reward_service_idx'
  )
order by indexname;

select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'inventory_products_touch_updated_at',
    'inventory_movements_match_salon',
    'salon_loyalty_programs_validate_reward_service'
  )
order by trigger_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'touch_inventory_products_updated_at',
    'ensure_inventory_movement_matches_salon',
    'register_inventory_movement',
    'get_owner_operations_dashboard',
    'ensure_loyalty_reward_service_matches_salon',
    'get_customer_loyalty_summary',
    'get_salon_loyalty_dashboard',
    'sync_appointment_loyalty_reward'
  )
order by routine_name;

select column_name, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'salon_loyalty_programs'
  and column_name in ('tier_one_name', 'tier_two_name', 'vip_tier_name')
order by column_name;

select policyname, tablename
from pg_policies
where schemaname = 'public'
  and tablename in ('inventory_products', 'inventory_movements')
order by tablename, policyname;
