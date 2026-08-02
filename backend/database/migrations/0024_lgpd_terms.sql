-- 0024: LGPD terms and user acceptance tracking
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
