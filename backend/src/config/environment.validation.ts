const REQUIRED_ORACLE_VARIABLES = [
  'ORACLE_HOST',
  'ORACLE_PORT',
  'ORACLE_SERVICE_NAME',
  'ORACLE_USER',
  'ORACLE_PASSWORD',
] as const;

const POSITIVE_INTEGER_VARIABLES = [
  'PORT',
  'AUTH_SESSION_TTL_SECONDS',
  'ORACLE_PORT',
  'ORACLE_POOL_MIN',
  'ORACLE_POOL_MAX',
  'ORACLE_POOL_TIMEOUT',
] as const;

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const oracleEnabled = environment.ORACLE_ENABLED ?? 'false';
  if (oracleEnabled !== 'true' && oracleEnabled !== 'false') {
    throw new Error('ORACLE_ENABLED must be either true or false');
  }

  if (oracleEnabled === 'true') {
    const missingVariables = REQUIRED_ORACLE_VARIABLES.filter(
      (name) => !environment[name],
    );
    if (missingVariables.length > 0) {
      throw new Error(
        `Missing required Oracle environment variables: ${missingVariables.join(', ')}`,
      );
    }
  }

  if (!environment.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  for (const name of POSITIVE_INTEGER_VARIABLES) {
    const value = environment[name];
    if (value === undefined) {
      continue;
    }

    const parsedValue = Number(value);
    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
      throw new Error(`${name} must be a positive integer`);
    }
  }

  const poolMin = Number(environment.ORACLE_POOL_MIN ?? 2);
  const poolMax = Number(environment.ORACLE_POOL_MAX ?? 10);
  if (poolMin > poolMax) {
    throw new Error('ORACLE_POOL_MIN cannot be greater than ORACLE_POOL_MAX');
  }

  return environment;
}
