insert into users (id, name, email, password_hash, role)
values
  (9101, 'Casa Aurora', 'contato@casaaurora.dev', '123', 'establishment')
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
  logo_url,
  gallery_urls,
  contact_email,
  contact_phone,
  instagram_url,
  website_url
)
values
  (
    2001,
    9101,
    'Casa Aurora',
    'Santa Maria',
    'Rua Venancio Aires, 1250 - Centro',
    'bar',
    'Espaco para encontros, musica ao vivo e eventos locais.',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
    json_array(
      'https://images.unsplash.com/photo-1514933651103-005eec06c04b',
      'https://images.unsplash.com/photo-1514361892635-6f5f0ec48102'
    ),
    'contato@casaaurora.dev',
    '(55) 99999-0000',
    'https://instagram.com/casaaurora',
    'https://casaaurora.example.com'
  )
on duplicate key update
  display_name = values(display_name),
  city = values(city),
  address = values(address),
  category = values(category),
  description = values(description),
  logo_url = values(logo_url),
  gallery_urls = values(gallery_urls),
  contact_email = values(contact_email),
  contact_phone = values(contact_phone),
  instagram_url = values(instagram_url),
  website_url = values(website_url);
