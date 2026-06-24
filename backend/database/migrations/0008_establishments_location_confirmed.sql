set @db_name = database();

set @has_location_confirmed = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'establishments'
    and column_name = 'location_confirmed'
);

set @sql_add_location_confirmed = if(
  @has_location_confirmed = 0,
  'alter table establishments add column location_confirmed tinyint(1) not null default 0 after lng',
  'select 1'
);
prepare stmt_add_location_confirmed from @sql_add_location_confirmed;
execute stmt_add_location_confirmed;
deallocate prepare stmt_add_location_confirmed;

update establishments
set location_confirmed = 1
where location_confirmed = 0
  and lat is not null
  and lng is not null;
