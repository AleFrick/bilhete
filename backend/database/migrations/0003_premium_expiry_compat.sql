set @db_name = database();

set @has_premium_expires_at = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'profiles'
    and column_name = 'premium_expires_at'
);

set @sql_add_premium_expires_at = if(
  @has_premium_expires_at = 0,
  'alter table profiles add column premium_expires_at timestamp null after premium_status',
  'select 1'
);
prepare stmt_add_premium_expires_at from @sql_add_premium_expires_at;
execute stmt_add_premium_expires_at;
deallocate prepare stmt_add_premium_expires_at;
