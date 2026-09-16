import { registerAs } from '@nestjs/config';

export default registerAs('oracle', () => ({
  enabled: process.env.ORACLE_ENABLED === 'true',
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: `${process.env.ORACLE_HOST}:${process.env.ORACLE_PORT}/${process.env.ORACLE_SERVICE_NAME}`,
  poolMin: Number(process.env.ORACLE_POOL_MIN ?? 2),
  poolMax: Number(process.env.ORACLE_POOL_MAX ?? 10),
  poolTimeout: Number(process.env.ORACLE_POOL_TIMEOUT ?? 60),
}));