set @db_name = database();

set @has_link_note = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'venues'
    and column_name = 'establishment_link_note'
);

set @sql_add_link_note = if(
  @has_link_note = 0,
  'alter table venues add column establishment_link_note text null after establishment_link_status',
  'select 1'
);
prepare stmt_add_link_note from @sql_add_link_note;
execute stmt_add_link_note;
deallocate prepare stmt_add_link_note;

set @has_link_documents = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'venues'
    and column_name = 'establishment_link_documents'
);

set @sql_add_link_documents = if(
  @has_link_documents = 0,
  'alter table venues add column establishment_link_documents json null after establishment_link_note',
  'select 1'
);
prepare stmt_add_link_documents from @sql_add_link_documents;
execute stmt_add_link_documents;
deallocate prepare stmt_add_link_documents;
