🚀 Projeto Bilhete: Guia de Desenvolvimento e Arquitetura
Este documento define a arquitetura, o design e as regras de negócio para o desenvolvimento do app Bilhete.

1. Identidade Visual (Baseada em WhatsApp Image 2026-06-19 at 21.00.42.jpeg)
O desenvolvimento deve seguir rigorosamente os padrões abaixo:

Paleta de Cores:

#0F0F14 (Preto - Fundo)

#1C1C24 (Grafite - Containers)

#F2F2F7 (Gelo - Textos)

#FF2D55 (Destaque - Ações Primárias)

#7B5CFF (Neon - Identidade/Premium)

Tipografia: Poppins (Regular, Medium, Bold).

Conceito de Design: Dark Mode nativo, minimalista, focado em interações contextuais.

2. Stack Tecnológica
Frontend: Flutter (Mobile - Android/iOS).

Backend: Supabase (PostgreSQL, Realtime, Auth).

Push Notifications: Firebase.

Pagamentos: Stripe API.

3. Arquitetura de Dados e Segurança (Prioridade Crítica)
O sistema deve ser imune a vazamentos de privacidade.

Modelo de Dados (PostgreSQL):

profiles: id, name, status_social, premium_status, venue_id.

venues: id, name, lat, lng, partner_status.

checkins: user_id, venue_id, timestamp.

bilhetes: from_user, to_user, type, status.

Segurança (RLS - Row Level Security):

Usuários nunca devem ter acesso às coordenadas (lat/lng) uns dos outros.

Consultas de feed devem ser filtradas estritamente pelo venue_id.

4. Fluxo de Negócio e Mecânicas
Check-in: O usuário realiza check-in em um venue_id. O app torna o perfil visível apenas para usuários com o mesmo venue_id ativo.

Bilhetes: Interações limitadas (curtidas, emojis, "Troquei olhares").

Match & Chat: O chat é criado via chat_id. A expiração é disparada por trigger no banco de dados assim que o checkout for registrado ou o tempo limite for atingido.

Radar Premium: Acesso aos dados agregados de venues (lotação e status social predominante).

5. Roadmap de Implementação (Fase MVP)
Semana 1: Configuração do Supabase, Schemas e Design System (UI Kit no Figma).

Semana 2: Autenticação e Perfil (Login Apple/Google).

Semana 3: Lógica de Geofencing (Check-in/Checkout).

Semana 4: Sistema de Bilhetes e Chat Realtime.

Semana 5: Integração Stripe e Dashboard Bares (B2B).

Semana 6: Testes Piloto em Santa Maria-RS.

6. Diretrizes de Pair Programming para IA
Clean Code: Priorize o padrão Clean Architecture. Cada feature deve ter sua própria pasta (/features/auth, /features/chat).

Resiliência: Todo fluxo de rede deve conter Error Handling robusto (Timeout, Conexão perdida).

Performance: Use const onde possível no Flutter e evite reconstruções desnecessárias de widgets (const constructors).