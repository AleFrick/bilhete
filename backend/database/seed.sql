insert ignore into venues (id, name, address, lat, lng, partner_status, category)
values
  (1, 'Boteco do Ze', 'Rua do Acampamento, 975 - Santa Maria/RS', -29.6882, -53.8069, 1, 'bar'),
  (2, 'Pub Universitario 7', 'Centro, Santa Maria/RS', -29.6900, -53.8081, 0, 'pub');

insert ignore into users (id, name, email, password_hash)
values
  (101, 'Ana Teste', 'ana.teste@bilhete.dev', '123'),
  (102, 'Bruno Teste', 'bruno.teste@bilhete.dev', '123');

insert ignore into users (id, name, email, password_hash, role)
values
  (9001, 'Administrador Bilhete', 'admin@bilhete.dev', '123', 'admin');

insert ignore into profiles (user_id, name, age, bio, photo_urls, status_social, premium_status, premium_expires_at, venue_id)
values
  (101, 'Ana Teste', 26, 'Curte bar e conversa boa.', json_array('https://images.unsplash.com/photo-1494790108377-be9c29b29330'), 'conversar', 1, date_add(current_timestamp, interval 30 day), 1),
  (102, 'Bruno Teste', 28, 'Sempre no role com a galera.', json_array('https://images.unsplash.com/photo-1500648767791-00dcc994a43e'), 'flertar', 0, null, 1);

insert ignore into checkins (id, user_id, venue_id, active)
values
  (101, 101, 1, 1),
  (102, 102, 1, 1);
