create table if not exists users (
  id bigint primary key auto_increment,
  name varchar(120) not null,
  email varchar(190) not null unique,
  password_hash varchar(255) not null,
  created_at timestamp not null default current_timestamp
);

create table if not exists venues (
  id bigint primary key auto_increment,
  name varchar(160) not null,
  address varchar(220),
  lat decimal(10, 7),
  lng decimal(10, 7),
  partner_status tinyint(1) not null default 0,
  category varchar(80),
  created_at timestamp not null default current_timestamp
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
  key idx_checkins_user_active (user_id, active),
  key idx_checkins_venue_active (venue_id, active),
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
  key idx_bilhetes_to_user (to_user, created_at),
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
  key idx_messages_chat (chat_id, created_at),
  constraint fk_messages_chat foreign key (chat_id) references chats(id) on delete cascade,
  constraint fk_messages_sender foreign key (sender_id) references users(id) on delete cascade
);
