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
