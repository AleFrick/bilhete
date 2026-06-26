create table if not exists establishment_support_tickets (
  id bigint primary key auto_increment,
  establishment_id bigint not null,
  subject varchar(160) not null,
  message text not null,
  status enum('open', 'in_progress', 'resolved') not null default 'open',
  admin_response text,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_establishment_support_tickets_establishment
    foreign key (establishment_id) references establishments(id) on delete cascade
);

create index idx_establishment_support_tickets_establishment_status
  on establishment_support_tickets(establishment_id, status, created_at);

create index idx_establishment_support_tickets_status_created
  on establishment_support_tickets(status, created_at);
