set @db_name = database();

set @has_establishment_id = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'venues'
    and column_name = 'establishment_id'
);

set @sql_add_establishment_id = if(
  @has_establishment_id = 0,
  'alter table venues add column establishment_id bigint null after category',
  'select 1'
);
prepare stmt_add_establishment_id from @sql_add_establishment_id;
execute stmt_add_establishment_id;
deallocate prepare stmt_add_establishment_id;

set @has_link_status = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'venues'
    and column_name = 'establishment_link_status'
);

set @sql_add_link_status = if(
  @has_link_status = 0,
  "alter table venues add column establishment_link_status enum('none','pending','approved','rejected') not null default 'none' after establishment_id",
  'select 1'
);
prepare stmt_add_link_status from @sql_add_link_status;
execute stmt_add_link_status;
deallocate prepare stmt_add_link_status;

set @has_requested_at = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'venues'
    and column_name = 'establishment_link_requested_at'
);

set @sql_add_requested_at = if(
  @has_requested_at = 0,
  'alter table venues add column establishment_link_requested_at timestamp null after establishment_link_status',
  'select 1'
);
prepare stmt_add_requested_at from @sql_add_requested_at;
execute stmt_add_requested_at;
deallocate prepare stmt_add_requested_at;

set @has_approved_at = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'venues'
    and column_name = 'establishment_link_approved_at'
);

set @sql_add_approved_at = if(
  @has_approved_at = 0,
  'alter table venues add column establishment_link_approved_at timestamp null after establishment_link_requested_at',
  'select 1'
);
prepare stmt_add_approved_at from @sql_add_approved_at;
execute stmt_add_approved_at;
deallocate prepare stmt_add_approved_at;

set @has_fk = (
  select count(*)
  from information_schema.table_constraints
  where table_schema = @db_name
    and table_name = 'venues'
    and constraint_type = 'FOREIGN KEY'
    and constraint_name = 'fk_venues_establishment'
);

set @sql_add_fk = if(
  @has_fk = 0,
  'alter table venues add constraint fk_venues_establishment foreign key (establishment_id) references establishments(id) on delete set null',
  'select 1'
);
prepare stmt_add_fk from @sql_add_fk;
execute stmt_add_fk;
deallocate prepare stmt_add_fk;

set @has_index_establishment = (
  select count(*)
  from information_schema.statistics
  where table_schema = @db_name
    and table_name = 'venues'
    and index_name = 'idx_venues_establishment'
);

set @sql_add_index_establishment = if(
  @has_index_establishment = 0,
  'create index idx_venues_establishment on venues(establishment_id, establishment_link_status)',
  'select 1'
);
prepare stmt_add_index_establishment from @sql_add_index_establishment;
execute stmt_add_index_establishment;
deallocate prepare stmt_add_index_establishment;
