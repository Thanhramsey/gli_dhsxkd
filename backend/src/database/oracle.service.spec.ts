import { ConfigService } from '@nestjs/config';
import oracledb from 'oracledb';
import { OracleService } from './oracle.service.js';

describe('OracleService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('materializes an OUT cursor before closing the connection', async () => {
    const resultSet = {
      getRows: vi
        .fn()
        .mockResolvedValueOnce([{ KPI_CODE: 'REVENUE' }])
        .mockResolvedValueOnce([]),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const connection = {
      execute: vi.fn().mockResolvedValue({
        outBinds: { p_cursor: resultSet, p_total: 1 },
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const pool = {
      getConnection: vi.fn().mockResolvedValue(connection),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(oracledb, 'createPool').mockResolvedValue(
      pool as unknown as oracledb.Pool,
    );
    const configService = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          'oracle.enabled': true,
          'oracle.poolMin': 2,
          'oracle.poolMax': 10,
          'oracle.poolTimeout': 60,
        };
        return values[key] ?? defaultValue;
      }),
      getOrThrow: vi.fn((key: string) => {
        const values: Record<string, string> = {
          'oracle.user': 'user',
          'oracle.password': 'password',
          'oracle.connectString': 'localhost:1521/ORCLPDB1',
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const service = new OracleService(configService);

    await service.onModuleInit();
    const result = await service.executeProcedure('PKG_DASHBOARD', 'GET_KPI', {
      p_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
    });

    expect(result.outBinds).toEqual({
      p_cursor: [{ KPI_CODE: 'REVENUE' }],
      p_total: 1,
    });
    expect(resultSet.close).toHaveBeenCalledOnce();
    expect(connection.close).toHaveBeenCalledOnce();
    expect(resultSet.close.mock.invocationCallOrder[0]).toBeLessThan(
      connection.close.mock.invocationCallOrder[0],
    );
  });

  it('checks the live Oracle connection with SYSDATE', async () => {
    const databaseTime = new Date('2026-09-16T07:00:00.000Z');
    const connection = {
      execute: vi.fn().mockResolvedValue({
        rows: [{ DATABASE_TIME: databaseTime }],
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const pool = {
      getConnection: vi.fn().mockResolvedValue(connection),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(oracledb, 'createPool').mockResolvedValue(
      pool as unknown as oracledb.Pool,
    );
    const configService = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          'oracle.enabled': true,
          'oracle.poolMin': 2,
          'oracle.poolMax': 10,
          'oracle.poolTimeout': 60,
        };
        return values[key] ?? defaultValue;
      }),
      getOrThrow: vi.fn((key: string) => {
        const values: Record<string, string> = {
          'oracle.user': 'user',
          'oracle.password': 'password',
          'oracle.connectString': 'localhost:1521/ORCLPDB1',
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const service = new OracleService(configService);

    await service.onModuleInit();
    const result = await service.checkConnection();

    expect(connection.execute).toHaveBeenCalledWith(
      'SELECT SYSDATE AS DATABASE_TIME FROM DUAL',
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    expect(result).toEqual({
      status: 'connected',
      databaseTime: '2026-09-16T07:00:00.000Z',
    });
    expect(connection.close).toHaveBeenCalledOnce();
  });
});