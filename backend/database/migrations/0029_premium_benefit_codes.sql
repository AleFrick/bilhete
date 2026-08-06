-- 0029: Premium benefit catalog + subscription snapshot
-- Catálogo de códigos de benefício (code, label, param_schema, enforced).
-- premium_packages.benefits passa a armazenar objetos { code, label, params }.
-- premium_subscriptions ganha snapshot do pacote/benefícios na ativação.
-- A normalização de benefits legados (strings -> objetos) é feita no backend
-- (mapPackageRow) para evitar SQL JSON complexo e permanecer reversível.
--
-- O seed dos codes foi movido para scripts/syncBenefitCodes.js, que lê
-- src/services/premiumBenefitCodes.js (fonte canônica) e popula o banco.
-- Rode `npm run sync:benefits` após aplicar esta migration.

create table if not exists premium_benefit_catalog (
  id bigint primary key auto_increment,
  code varchar(60) not null,
  label varchar(140) not null,
  description text,
  target_group enum('user', 'establishment') not null,
  param_schema json null,
  enforced tinyint(1) not null default 0,
  active tinyint(1) not null default 1,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  unique key uniq_premium_benefit_catalog_code (code)
);

create index idx_premium_benefit_catalog_group_active
  on premium_benefit_catalog(target_group, active, code);

-- Snapshot do pacote/benefícios na assinatura (preenchido na ativação do pagamento).
alter table premium_subscriptions
  add column package_id bigint null,
  add column benefits_snapshot json null;

create index idx_premium_subscriptions_package
  on premium_subscriptions(package_id);
