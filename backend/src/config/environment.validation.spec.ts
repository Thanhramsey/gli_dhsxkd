import { validateEnvironment } from './environment.validation.js';

describe('validateEnvironment', () => {
  it('accepts the default configuration with Oracle disabled', () => {
    expect(validateEnvironment({ JWT_SECRET: 'test-secret' })).toEqual({
      JWT_SECRET: 'test-secret',
    });
  });

  it('requires connection details when Oracle is enabled', () => {
    expect(() => validateEnvironment({ ORACLE_ENABLED: 'true' })).toThrow(
      'Missing required Oracle environment variables',
    );
  });

  it('rejects an invalid pool range', () => {
    expect(() =>
      validateEnvironment({
        ORACLE_POOL_MIN: '5',
        ORACLE_POOL_MAX: '2',
        JWT_SECRET: 'test-secret',
      }),
    ).toThrow('ORACLE_POOL_MIN cannot be greater than ORACLE_POOL_MAX');
  });
});
