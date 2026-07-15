set @db_name = database();

set @has_is_active = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'users'
    and column_name = 'is_active'
);

set @sql_add_is_active = if(
  @has_is_active = 0,
  'alter table users add column is_active tinyint(1) not null default 1 after role',
  'select 1'
);
prepare stmt_add_is_active from @sql_add_is_active;
execute stmt_add_is_active;
deallocate prepare stmt_add_is_active;

set @has_email_verification_token_hash = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'users'
    and column_name = 'email_verification_token_hash'
);

set @sql_add_email_verification_token_hash = if(
  @has_email_verification_token_hash = 0,
  'alter table users add column email_verification_token_hash char(64) null after is_active',
  'select 1'
);
prepare stmt_add_email_verification_token_hash from @sql_add_email_verification_token_hash;
execute stmt_add_email_verification_token_hash;
deallocate prepare stmt_add_email_verification_token_hash;

set @has_email_verification_expires_at = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'users'
    and column_name = 'email_verification_expires_at'
);

set @sql_add_email_verification_expires_at = if(
  @has_email_verification_expires_at = 0,
  'alter table users add column email_verification_expires_at timestamp null after email_verification_token_hash',
  'select 1'
);
prepare stmt_add_email_verification_expires_at from @sql_add_email_verification_expires_at;
execute stmt_add_email_verification_expires_at;
deallocate prepare stmt_add_email_verification_expires_at;

set @has_email_verified_at = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'users'
    and column_name = 'email_verified_at'
);

set @sql_add_email_verified_at = if(
  @has_email_verified_at = 0,
  'alter table users add column email_verified_at timestamp null after email_verification_expires_at',
  'select 1'
);
prepare stmt_add_email_verified_at from @sql_add_email_verified_at;
execute stmt_add_email_verified_at;
deallocate prepare stmt_add_email_verified_at;

set @has_idx_users_active_email = (
  select count(*)
  from information_schema.statistics
  where table_schema = @db_name
    and table_name = 'users'
    and index_name = 'idx_users_active_email'
);

set @sql_add_idx_users_active_email = if(
  @has_idx_users_active_email = 0,
  'create index idx_users_active_email on users(is_active, email)',
  'select 1'
);
prepare stmt_add_idx_users_active_email from @sql_add_idx_users_active_email;
execute stmt_add_idx_users_active_email;
deallocate prepare stmt_add_idx_users_active_email;

set @has_uniq_users_email_verification_token_hash = (
  select count(*)
  from information_schema.statistics
  where table_schema = @db_name
    and table_name = 'users'
    and index_name = 'uniq_users_email_verification_token_hash'
);

set @sql_add_uniq_users_email_verification_token_hash = if(
  @has_uniq_users_email_verification_token_hash = 0,
  'create unique index uniq_users_email_verification_token_hash on users(email_verification_token_hash)',
  'select 1'
);
prepare stmt_add_uniq_users_email_verification_token_hash from @sql_add_uniq_users_email_verification_token_hash;
execute stmt_add_uniq_users_email_verification_token_hash;
deallocate prepare stmt_add_uniq_users_email_verification_token_hash;
