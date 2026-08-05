create table if not exists refresh_tokens (
  id int auto_increment primary key,
  token_hash varchar(64) not null,
  user_id int not null,
  expires_at datetime not null,
  revoked tinyint(1) not null default 0,
  created_at timestamp not null default current_timestamp,
  index idx_refresh_tokens_hash (token_hash),
  index idx_refresh_tokens_user (user_id),
  index idx_refresh_tokens_expires (expires_at)
) engine=InnoDB default charset=utf8mb4;
