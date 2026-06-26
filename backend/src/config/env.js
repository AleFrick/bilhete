import dotenv from 'dotenv';

const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const envPath = `.env.${environment}`;

dotenv.config({ path: envPath });
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || environment,
  envFile: envPath,
  port: Number(process.env.PORT || 3333),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '6mb',
  requestLoggingEnabled: (process.env.REQUEST_LOGGING_ENABLED || 'true') !== 'false',
  slowRequestMs: Number(process.env.SLOW_REQUEST_MS || 800),
  sqlLoggingEnabled: (process.env.SQL_LOGGING_ENABLED || 'true') !== 'false',
  slowQueryMs: Number(process.env.SLOW_QUERY_MS || 250),
  mysqlHost: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
  mysqlPort: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  mysqlUser: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  mysqlPassword: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
  mysqlDatabase: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'bilhete',
  passwordClientHashEnabled: (process.env.PASSWORD_CLIENT_HASH_ENABLED || 'false') === 'true',
  passwordHashAlgorithm: process.env.PASSWORD_HASH_ALGORITHM || 'sha512',
  passwordHashSecret: process.env.PASSWORD_HASH_SECRET || process.env.JWT_SECRET || 'troque_este_segredo',
  jwtSecret: process.env.JWT_SECRET || 'troque_este_segredo',
  frontendAppUrl: process.env.FRONTEND_APP_URL || 'http://localhost:5173/app',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3333/api/auth/google/callback',
  facebookClientId: process.env.FACEBOOK_CLIENT_ID || '',
  facebookClientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
  facebookRedirectUri: process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:3333/api/auth/facebook/callback',
  appleClientId: process.env.APPLE_CLIENT_ID || '',
  appleClientSecret: process.env.APPLE_CLIENT_SECRET || '',
  appleRedirectUri: process.env.APPLE_REDIRECT_URI || 'http://localhost:3333/api/auth/apple/callback',
};
