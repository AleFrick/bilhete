create table if not exists establishment_support_ticket_messages (
  id bigint primary key auto_increment,
  ticket_id bigint not null,
  sender_role enum('admin', 'establishment') not null,
  message text not null,
  created_at timestamp not null default current_timestamp,
  constraint fk_establishment_support_ticket_messages_ticket
    foreign key (ticket_id) references establishment_support_tickets(id) on delete cascade
);

create index idx_establishment_support_ticket_messages_ticket_created
  on establishment_support_ticket_messages(ticket_id, created_at);
