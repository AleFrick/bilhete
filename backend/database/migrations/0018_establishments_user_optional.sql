set @db_name = database();

set @has_user_id = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'establishments'
    and column_name = 'user_id'
);

set @sql_alter_user_id = if(
  @has_user_id > 0,
  'alter table establishments modify column user_id bigint null',
  'select 1'
);
prepare stmt_alter_user_id from @sql_alter_user_id;
execute stmt_alter_user_id;
deallocate prepare stmt_alter_user_id;

set @has_display_name = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'establishments'
    and column_name = 'display_name'
);

set @sql_alter_display_name = if(
  @has_display_name > 0,
  'alter table establishments modify column display_name varchar(160) null',
  'select 1'
);
prepare stmt_alter_display_name from @sql_alter_display_name;
execute stmt_alter_display_name;
deallocate prepare stmt_alter_display_name;
