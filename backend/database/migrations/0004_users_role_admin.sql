set @db_name = database();

set @has_role = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'users'
    and column_name = 'role'
);

set @sql_add_role = if(
  @has_role = 0,
  "alter table users add column role enum('user','admin') not null default 'user' after password_hash",
  'select 1'
);
prepare stmt_add_role from @sql_add_role;
execute stmt_add_role;
deallocate prepare stmt_add_role;

set @admin_exists = (
  select count(*)
  from users
  where email = 'admin@bilhete.dev'
);

set @sql_seed_admin = if(
  @admin_exists = 0,
  "insert into users (name, email, password_hash, role) values ('Administrador Bilhete', 'admin@bilhete.dev', '123', 'admin')",
  'select 1'
);
prepare stmt_seed_admin from @sql_seed_admin;
execute stmt_seed_admin;
deallocate prepare stmt_seed_admin;
