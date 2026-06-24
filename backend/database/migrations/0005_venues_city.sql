set @db_name = database();

set @has_city = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'venues'
    and column_name = 'city'
);

set @sql_add_city = if(
  @has_city = 0,
  'alter table venues add column city varchar(120) null after name',
  'select 1'
);
prepare stmt_add_city from @sql_add_city;
execute stmt_add_city;
deallocate prepare stmt_add_city;

update venues
set city = trim(substring_index(substring_index(address, '/', 1), ',', -1))
where (city is null or trim(city) = '')
  and address is not null
  and trim(address) <> '';
