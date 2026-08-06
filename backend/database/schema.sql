create table if not exists users (
  id bigint primary key auto_increment,
  name varchar(120) not null,
  email varchar(190) not null unique,
  password_hash varchar(255) not null,
  role enum('user', 'admin', 'establishment') not null default 'user',
  is_active tinyint(1) not null default 1,
  email_verification_token_hash char(64),
  email_verification_expires_at timestamp null,
  email_verified_at timestamp null,
  password_reset_token_hash char(64),
  password_reset_expires_at timestamp null,
  token_version int not null default 0,
  pending_email varchar(190) null,
  pending_email_token_hash char(64) null,
  pending_email_expires_at timestamp null,
  created_at timestamp not null default current_timestamp
);

create table if not exists establishments (
  id bigint primary key auto_increment,
  user_id bigint null unique,
  display_name varchar(160),
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

create table if not exists premium_promotions (
  id bigint primary key auto_increment,
  target_group enum('user', 'establishment') not null,
  name varchar(140) not null,
  description text,
  starts_at timestamp not null,
  ends_at timestamp null,
  status enum('scheduled', 'active', 'ended') not null default 'scheduled',
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp
);

create table if not exists premium_packages (
  id bigint primary key auto_increment,
  target_group enum('user', 'establishment') not null,
  promotion_id bigint null,
  title varchar(140) not null,
  description text,
  benefits json null,
  is_free tinyint(1) not null default 0,
  price_cents int not null,
  duration_days int not null,
  display_order int not null default 0,
  active tinyint(1) not null default 1,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_premium_packages_promotion
    foreign key (promotion_id) references premium_promotions(id) on delete set null
);

create table if not exists premium_coupons (
  id bigint primary key auto_increment,
  target_group enum('user', 'establishment') not null,
  code varchar(40) not null,
  description text,
  discount_type enum('percent', 'fixed') not null,
  discount_value decimal(10, 2) not null,
  usage_limit int null,
  used_count int not null default 0,
  active tinyint(1) not null default 1,
  valid_from timestamp null,
  valid_until timestamp null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  unique key uniq_premium_coupons_code (code)
);

create table if not exists premium_orders (
  id bigint primary key auto_increment,
  user_id bigint not null,
  target_group enum('user', 'establishment') not null,
  package_id bigint not null,
  coupon_id bigint null,
  coupon_code varchar(40),
  base_price_cents int not null,
  discount_cents int not null default 0,
  final_price_cents int not null,
  status enum('pending', 'paid', 'failed', 'cancelled') not null default 'pending',
  payment_provider varchar(40),
  payment_reference varchar(120),
  payment_url text,
  created_at timestamp not null default current_timestamp,
  paid_at timestamp null,
  constraint fk_premium_orders_user
    foreign key (user_id) references users(id) on delete cascade,
  constraint fk_premium_orders_package
    foreign key (package_id) references premium_packages(id) on delete restrict,
  constraint fk_premium_orders_coupon
    foreign key (coupon_id) references premium_coupons(id) on delete set null
);

create table if not exists premium_subscriptions (
  id bigint primary key auto_increment,
  user_id bigint not null,
  target_group enum('user', 'establishment') not null,
  starts_at timestamp not null,
  ends_at timestamp not null,
  status enum('active', 'expired', 'cancelled') not null default 'active',
  package_id bigint null,
  benefits_snapshot json null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  unique key uniq_premium_subscriptions_user_group (user_id, target_group),
  constraint fk_premium_subscriptions_user
    foreign key (user_id) references users(id) on delete cascade
);

create table if not exists premium_benefit_catalog (
  id bigint primary key auto_increment,
  code varchar(60) not null,
  label varchar(140) not null,
  description text,
  target_group enum('user', 'establishment') not null,
  param_schema json null,
  enforced tinyint(1) not null default 0,
  active tinyint(1) not null default 1,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  unique key uniq_premium_benefit_catalog_code (code)
);

create index idx_premium_benefit_catalog_group_active
  on premium_benefit_catalog(target_group, active, code);

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
create index idx_users_active_email on users(is_active, email);
create unique index uniq_users_email_verification_token_hash on users(email_verification_token_hash);
create index idx_premium_promotions_group_status_start
  on premium_promotions(target_group, status, starts_at, ends_at);
create index idx_premium_packages_group_active_order
  on premium_packages(target_group, active, display_order);
create index idx_premium_coupons_group_active_valid
  on premium_coupons(target_group, active, valid_from, valid_until);
create index idx_premium_orders_user_group_created
  on premium_orders(user_id, target_group, created_at);
create index idx_premium_orders_status_created
  on premium_orders(status, created_at);
create index idx_premium_subscriptions_user_group_status
  on premium_subscriptions(user_id, target_group, status, ends_at);
create index idx_venues_establishment on venues(establishment_id, establishment_link_status);
create index idx_venues_city_id on venues(city, id);
create index idx_venues_category_id on venues(category, id);
create index idx_establishment_support_tickets_establishment_status
  on establishment_support_tickets(establishment_id, status, created_at);
create index idx_establishment_support_tickets_status_created
  on establishment_support_tickets(status, created_at);
create index idx_establishment_support_ticket_messages_ticket_created
  on establishment_support_ticket_messages(ticket_id, created_at);
create index idx_establishment_agenda_events_date on establishment_agenda_events(establishment_id, event_date, start_time);
create index idx_bilhetes_to_user on bilhetes(to_user, created_at desc);
create index idx_messages_chat on messages(chat_id, created_at);

create table if not exists payment_settings (
  id tinyint primary key default 1,
  provider varchar(40) not null default 'asaas',
  environment enum('sandbox', 'production') not null default 'sandbox',
  api_key varchar(255),
  api_url varchar(255),
  webhook_token varchar(255),
  enabled tinyint(1) not null default 0,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint chk_payment_settings_single_row check (id = 1)
);

create table if not exists payment_customers (
  id bigint primary key auto_increment,
  user_id bigint not null,
  provider varchar(40) not null default 'asaas',
  provider_customer_id varchar(120) not null,
  created_at timestamp not null default current_timestamp,
  unique key uniq_payment_customers_user_provider (user_id, provider),
  constraint fk_payment_customers_user foreign key (user_id) references users(id) on delete cascade
);

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

create table if not exists lgpd_terms (
  id bigint primary key auto_increment,
  version varchar(20) not null unique,
  title varchar(200) not null,
  body text not null,
  is_active tinyint(1) not null default 1,
  created_at timestamp not null default current_timestamp
);

create table if not exists user_terms_acceptance (
  id bigint primary key auto_increment,
  user_id bigint not null,
  terms_id bigint not null,
  terms_version varchar(20) not null,
  accepted_at timestamp not null default current_timestamp,
  ip_address varchar(45),
  user_agent varchar(500),
  constraint fk_user_terms_acceptance_user
    foreign key (user_id) references users(id) on delete cascade,
  constraint fk_user_terms_acceptance_terms
    foreign key (terms_id) references lgpd_terms(id) on delete cascade
);

create index idx_user_terms_acceptance_user on user_terms_acceptance(user_id, accepted_at desc);
create index idx_lgpd_terms_active on lgpd_terms(is_active, created_at desc);

create table if not exists notifications (
  id bigint primary key auto_increment,
  user_id bigint not null,
  type varchar(40) not null,
  title varchar(200) not null,
  body varchar(500) default null,
  data json default null,
  is_read tinyint(1) not null default 0,
  created_at timestamp not null default current_timestamp,
  constraint fk_notifications_user foreign key (user_id) references users(id) on delete cascade,
  index idx_notifications_user_unread (user_id, is_read, created_at desc)
);

create table if not exists revoked_tokens (
  jti varchar(64) primary key,
  user_id bigint not null,
  expires_at timestamp not null,
  created_at timestamp not null default current_timestamp,
  constraint fk_revoked_tokens_user foreign key (user_id) references users(id) on delete cascade,
  index idx_revoked_tokens_user (user_id),
  index idx_revoked_tokens_expires (expires_at)
);
