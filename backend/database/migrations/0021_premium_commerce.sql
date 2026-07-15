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
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  unique key uniq_premium_subscriptions_user_group (user_id, target_group),
  constraint fk_premium_subscriptions_user
    foreign key (user_id) references users(id) on delete cascade
);

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
