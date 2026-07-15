set @db_name = database();

set @has_idx_venues_city_id = (
  select count(*)
  from information_schema.statistics
  where table_schema = @db_name
    and table_name = 'venues'
    and index_name = 'idx_venues_city_id'
);

set @sql_add_idx_venues_city_id = if(
  @has_idx_venues_city_id = 0,
  'create index idx_venues_city_id on venues(city, id)',
  'select 1'
);
prepare stmt_add_idx_venues_city_id from @sql_add_idx_venues_city_id;
execute stmt_add_idx_venues_city_id;
deallocate prepare stmt_add_idx_venues_city_id;

set @has_idx_venues_category_id = (
  select count(*)
  from information_schema.statistics
  where table_schema = @db_name
    and table_name = 'venues'
    and index_name = 'idx_venues_category_id'
);

set @sql_add_idx_venues_category_id = if(
  @has_idx_venues_category_id = 0,
  'create index idx_venues_category_id on venues(category, id)',
  'select 1'
);
prepare stmt_add_idx_venues_category_id from @sql_add_idx_venues_category_id;
execute stmt_add_idx_venues_category_id;
deallocate prepare stmt_add_idx_venues_category_id;
