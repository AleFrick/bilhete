# Bilhete MVP - React + Node + MySQL

Projeto implementado conforme o descritivo funcional com base em:

- frontend em React (Vite)
- backend em Node.js (Express)
- banco MySQL

## Modulos implementados

- Autenticacao: cadastro e login por email/senha
- Perfil: consulta e atualizacao de dados sociais
- Check-in e checkout por venue
- Feed local: pessoas visiveis somente no mesmo venue ativo
- Bilhetes: envio, inbox, outbox, resposta
- Match + Chat temporario
- Radar premium com dados agregados de venues

## Estrutura

- frontend: app React com telas do MVP
- backend: API Node/Express
- backend/database: schema.sql, seed.sql e migrations SQL

## Como rodar

### 1. Banco MySQL

Crie o banco e rode as migrations manualmente:

```sql
create database bilhete;
use bilhete;
```

```bash
cd backend
npm run migrate
```

Para conferir o status:

```bash
npm run migrate:status
```

Para aplicar ate uma migration especifica:

```bash
node scripts/migrate.js up 0002_profiles_age_photo_compat.sql
```

Dados de teste continuam no seed manual:

```sql
source backend/database/seed.sql;
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

## Variaveis de ambiente backend

Arquivo [.env.example](backend/.env.example):

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`

## Endpoints principais

- Auth: `POST /api/auth/register`, `POST /api/auth/login`
- Perfil: `GET /api/me`, `PUT /api/me`
- Venues: `GET /api/venues`, `GET /api/venues/:venueId/people`, `GET /api/radar`
- Presenca: `GET /api/checkins/current`, `POST /api/checkins`, `POST /api/checkout`
- Bilhetes: `POST /api/bilhetes`, `GET /api/bilhetes/inbox`, `GET /api/bilhetes/outbox`, `POST /api/bilhetes/:id/respond`
- Conversas: `GET /api/chats`, `GET /api/chats/:chatId/messages`, `POST /api/chats/:chatId/messages`

## Regras de privacidade aplicadas

- Coordenadas `lat/lng` nao sao retornadas ao frontend em listagem publica.
- Pessoas no local so podem ser consultadas por quem tiver check-in ativo no mesmo venue.
- Checkout reduz expiracao de chats relacionados para preservar contexto temporario.
