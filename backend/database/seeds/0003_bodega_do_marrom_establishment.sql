insert into users (id, name, email, password_hash, role)
values
  (9102, 'Bodega do Marrom', 'contato@bodegadomarrom.dev', '123', 'establishment')
on duplicate key update
  name = values(name),
  password_hash = values(password_hash),
  role = 'establishment';

insert into establishments (
  id,
  user_id,
  display_name,
  city,
  address,
  category,
  description,
  contact_email,
  contact_phone,
  instagram_url,
  website_url
)
values
  (
    2002,
    9102,
    'Bodega do Marrom',
    'Santa Maria',
    'Av. Rio Branco, 420 - Centro',
    'bar',
    'Bodega com programacao de shows, promocoes e eventos tematicos.',
    'contato@bodegadomarrom.dev',
    '(55) 99888-7766',
    'https://instagram.com/bodegadomarrom',
    'https://bodegadomarrom.example.com'
  )
on duplicate key update
  display_name = values(display_name),
  city = values(city),
  address = values(address),
  category = values(category),
  description = values(description),
  contact_email = values(contact_email),
  contact_phone = values(contact_phone),
  instagram_url = values(instagram_url),
  website_url = values(website_url);
