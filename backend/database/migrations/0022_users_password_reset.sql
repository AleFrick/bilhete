-- 0022: Password reset token columns
alter table users
  add column password_reset_token_hash char(64) default null,
  add column password_reset_expires_at timestamp null default null;
