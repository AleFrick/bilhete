set @db_name = database();

set @has_age = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'profiles'
    and column_name = 'age'
);

set @sql_age = if(
  @has_age = 0,
  'alter table profiles add column age tinyint unsigned null after name',
  'select 1'
);
prepare stmt_age from @sql_age;
execute stmt_age;
deallocate prepare stmt_age;

set @has_photo_urls = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'profiles'
    and column_name = 'photo_urls'
);

set @sql_photo_urls = if(
  @has_photo_urls = 0,
  'alter table profiles add column photo_urls json null after bio',
  'select 1'
);
prepare stmt_photo_urls from @sql_photo_urls;
execute stmt_photo_urls;
deallocate prepare stmt_photo_urls;
