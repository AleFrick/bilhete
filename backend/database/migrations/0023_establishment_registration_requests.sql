-- 0023: Establishment registration requests with chat
create table if not exists establishment_registration_requests (
  id bigint primary key auto_increment,
  user_id bigint not null,
  establishment_name varchar(160) not null,
  contact_email varchar(190) not null,
  contact_phone varchar(40),
  cnpj varchar(20),
  description text,
  status enum('pending', 'approved', 'rejected') not null default 'pending',
  admin_note text,
  reviewed_at timestamp null,
  reviewed_by bigint null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_establishment_registration_requests_user
    foreign key (user_id) references users(id) on delete cascade
);

create table if not exists establishment_registration_request_messages (
  id bigint primary key auto_increment,
  request_id bigint not null,
  sender_role enum('admin', 'establishment') not null,
  message text not null,
  created_at timestamp not null default current_timestamp,
  constraint fk_establishment_registration_request_messages_request
    foreign key (request_id) references establishment_registration_requests(id) on delete cascade
);

create index idx_establishment_registration_requests_status_created
  on establishment_registration_requests(status, created_at);
create index idx_establishment_registration_requests_user
  on establishment_registration_requests(user_id, status);
create index idx_establishment_registration_request_messages_request_created
  on establishment_registration_request_messages(request_id, created_at);
