import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  environment: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  corsOrigins: (
    process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET,
  sessionTtlSeconds: Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 28_800),
  secureCookie: process.env.AUTH_COOKIE_SECURE === 'true',
  menuAdminCode: process.env.MENU_ADMIN_CODE ?? 'MENU_MANAGEMENT',
  adminGroupIds: (process.env.ADMIN_GROUP_IDS ?? '1')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
}));
