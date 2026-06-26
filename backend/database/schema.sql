create table if not exists users (
  id bigint primary key auto_increment,
  name varchar(120) not null,
  email varchar(190) not null unique,
  password_hash varchar(255) not null,
  role enum('user', 'admin', 'establishment') not null default 'user',
  created_at timestamp not null default current_timestamp
);

create table if not exists establishments (
  id bigint primary key auto_increment,
  user_id bigint not null unique,
  display_name varchar(160) not null,
  city varchar(120),
  address varchar(220),
  lat decimal(10, 7),
  lng decimal(10, 7),
  location_confirmed tinyint(1) not null default 0,
  category varchar(80),
  description text,
  logo_url text,
  gallery_urls json,
  contact_email varchar(190),
  contact_phone varchar(40),
  instagram_url varchar(255),
  website_url varchar(255),
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_establishments_user foreign key (user_id) references users(id) on delete cascade
);

create table if not exists venues (
  id bigint primary key auto_increment,
  name varchar(160) not null,
  city varchar(120),
  address varchar(220),
  lat decimal(10, 7),
  lng decimal(10, 7),
  partner_status tinyint(1) not null default 0,
  category varchar(80),
  establishment_id bigint null,
  establishment_link_status enum('none', 'pending', 'approved', 'rejected') not null default 'none',
  establishment_link_note text,
  establishment_link_documents json,
  establishment_link_requested_at timestamp null,
  establishment_link_approved_at timestamp null,
  created_at timestamp not null default current_timestamp,
  constraint fk_venues_establishment foreign key (establishment_id) references establishments(id) on delete set null
);

create table if not exists establishment_agenda_events (
  id bigint primary key auto_increment,
  establishment_id bigint not null,
  event_date date not null,
  start_time time not null,
  title varchar(180) not null,
  information text,
  party_flyer_url text,
  analytics_metadata json,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_establishment_agenda_events_establishment
    foreign key (establishment_id) references establishments(id) on delete cascade
);

create table if not exists establishment_support_tickets (
  id bigint primary key auto_increment,
  establishment_id bigint not null,
  subject varchar(160) not null,
  message text not null,
  attachment_urls json,
  status enum('open', 'in_progress', 'resolved') not null default 'open',
  admin_response text,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_establishment_support_tickets_establishment
    foreign key (establishment_id) references establishments(id) on delete cascade
);

create table if not exists establishment_support_ticket_messages (
  id bigint primary key auto_increment,
  ticket_id bigint not null,
  sender_role enum('admin', 'establishment') not null,
  message text not null,
  created_at timestamp not null default current_timestamp,
  constraint fk_establishment_support_ticket_messages_ticket
    foreign key (ticket_id) references establishment_support_tickets(id) on delete cascade
);

create table if not exists profiles (
  user_id bigint primary key,
  name varchar(120) not null,
  age tinyint unsigned,
  bio varchar(280),
  photo_urls json,
  status_social enum('conversar', 'flertar', 'amizade', 'networking', 'observando') not null default 'observando',
  premium_status tinyint(1) not null default 0,
  premium_expires_at timestamp null,
  venue_id bigint null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_profiles_user foreign key (user_id) references users(id) on delete cascade,
  constraint fk_profiles_venue foreign key (venue_id) references venues(id) on delete set null
);

create table if not exists checkins (
  id bigint primary key auto_increment,
  user_id bigint not null,
  venue_id bigint not null,
  checked_in_at timestamp not null default current_timestamp,
  checked_out_at timestamp null,
  active tinyint(1) not null default 1,
  constraint fk_checkins_user foreign key (user_id) references users(id) on delete cascade,
  constraint fk_checkins_venue foreign key (venue_id) references venues(id) on delete cascade
);

create table if not exists bilhetes (
  id bigint primary key auto_increment,
  from_user bigint not null,
  to_user bigint not null,
  venue_id bigint not null,
  type enum('curtida', 'emoji', 'troquei_olhares', 'mensagem_livre') not null,
  message varchar(300),
  status enum('enviado', 'respondido', 'ignorado', 'expirado') not null default 'enviado',
  created_at timestamp not null default current_timestamp,
  constraint fk_bilhetes_from_user foreign key (from_user) references users(id) on delete cascade,
  constraint fk_bilhetes_to_user foreign key (to_user) references users(id) on delete cascade,
  constraint fk_bilhetes_venue foreign key (venue_id) references venues(id) on delete cascade
);

create table if not exists matches (
  id bigint primary key auto_increment,
  user_1 bigint not null,
  user_2 bigint not null,
  venue_id bigint not null,
  created_at timestamp not null default current_timestamp,
  expires_at timestamp not null,
  unique key uniq_match (user_1, user_2, venue_id),
  constraint fk_matches_user1 foreign key (user_1) references users(id) on delete cascade,
  constraint fk_matches_user2 foreign key (user_2) references users(id) on delete cascade,
  constraint fk_matches_venue foreign key (venue_id) references venues(id) on delete cascade
);

create table if not exists chats (
  id bigint primary key auto_increment,
  match_id bigint not null unique,
  expires_at timestamp not null,
  created_at timestamp not null default current_timestamp,
  constraint fk_chats_match foreign key (match_id) references matches(id) on delete cascade
);

create table if not exists messages (
  id bigint primary key auto_increment,
  chat_id bigint not null,
  sender_id bigint not null,
  message text not null,
  created_at timestamp not null default current_timestamp,
  constraint fk_messages_chat foreign key (chat_id) references chats(id) on delete cascade,
  constraint fk_messages_sender foreign key (sender_id) references users(id) on delete cascade
);

create index idx_checkins_user_active on checkins(user_id, active);
create index idx_checkins_venue_active on checkins(venue_id, active);
create index idx_venues_establishment on venues(establishment_id, establishment_link_status);
create index idx_establishment_support_tickets_establishment_status
  on establishment_support_tickets(establishment_id, status, created_at);
create index idx_establishment_support_tickets_status_created
  on establishment_support_tickets(status, created_at);
create index idx_establishment_support_ticket_messages_ticket_created
  on establishment_support_ticket_messages(ticket_id, created_at);
create index idx_establishment_agenda_events_date on establishment_agenda_events(establishment_id, event_date, start_time);
create index idx_bilhetes_to_user on bilhetes(to_user, created_at desc);
create index idx_messages_chat on messages(chat_id, created_at);
