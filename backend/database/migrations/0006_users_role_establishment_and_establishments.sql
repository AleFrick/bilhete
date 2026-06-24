set @db_name = database();

set @has_establishment_role = (
  select count(*)
  from information_schema.columns
  where table_schema = @db_name
    and table_name = 'users'
    and column_name = 'role'
    and lower(column_type) like "%establishment%"
);

set @sql_add_establishment_role = if(
  @has_establishment_role = 0,
  "alter table users modify column role enum('user','admin','establishment') not null default 'user'",
  'select 1'
);
prepare stmt_add_establishment_role from @sql_add_establishment_role;
execute stmt_add_establishment_role;
deallocate prepare stmt_add_establishment_role;

create table if not exists establishments (
  id bigint primary key auto_increment,
  user_id bigint not null unique,
  display_name varchar(160) not null,
  city varchar(120),
  address varchar(220),
  lat decimal(10, 7),
  lng decimal(10, 7),
  category varchar(80),
  description text,
  logo_url varchar(255),
  gallery_urls json,
  contact_email varchar(190),
  contact_phone varchar(40),
  instagram_url varchar(255),
  website_url varchar(255),
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_establishments_user foreign key (user_id) references users(id) on delete cascade
);
