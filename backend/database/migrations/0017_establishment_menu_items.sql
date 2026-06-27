create table if not exists establishment_menu_items (
  id bigint primary key auto_increment,
  establishment_id bigint not null,
  name varchar(180) not null,
  description text,
  price decimal(10, 2),
  image_url varchar(255),
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_establishment_menu_items_establishment
    foreign key (establishment_id) references establishments(id) on delete cascade
);

create index idx_establishment_menu_items_establishment
  on establishment_menu_items(establishment_id);
