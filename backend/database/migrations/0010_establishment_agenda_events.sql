create table if not exists establishment_agenda_events (
  id bigint primary key auto_increment,
  establishment_id bigint not null,
  event_date date not null,
  start_time time not null,
  title varchar(180) not null,
  information text,
  party_flyer_url varchar(255),
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_establishment_agenda_events_establishment
    foreign key (establishment_id) references establishments(id) on delete cascade
);

create index idx_establishment_agenda_events_date
  on establishment_agenda_events(establishment_id, event_date, start_time);
