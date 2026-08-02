alter table users add column pending_email varchar(190) null;
alter table users add column pending_email_token_hash char(64) null;
alter table users add column pending_email_expires_at timestamp null;
