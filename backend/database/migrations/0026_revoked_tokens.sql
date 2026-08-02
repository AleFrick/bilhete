alter table users add column token_version int not null default 0;

create table if not exists revoked_tokens (
  jti varchar(64) primary key,
  user_id bigint not null,
  expires_at timestamp not null,
  created_at timestamp not null default current_timestamp,
  constraint fk_revoked_tokens_user foreign key (user_id) references users(id) on delete cascade,
  index idx_revoked_tokens_user (user_id),
  index idx_revoked_tokens_expires (expires_at)
);
