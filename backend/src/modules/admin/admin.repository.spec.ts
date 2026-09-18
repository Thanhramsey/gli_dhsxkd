import { describe, expect, it, vi } from 'vitest';
import type { OracleService } from '../../database/oracle.service.js';
import { AdminRepository } from './admin.repository.js';

describe('AdminRepository', () => {
  it('queries users using columns from V_NGUOIDUNG_DIABAN', async () => {
    const executeQuery = vi.fn().mockResolvedValueOnce([]);
    const repository = new AdminRepository({ executeQuery } as unknown as OracleService);

    await repository.findUsers('habtt.bdh');

    const [sql, binds] = executeQuery.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(sql).toContain('UPPER(u.TEN_NV) LIKE :searchLike');
    expect(sql).toContain('g.NHOMND_ID = u.LEVEL_ROLE');
    expect(sql).not.toContain('V_NGUOIDUNG_NHOMND');
    expect(sql).not.toContain('UPPER(u.TEN_ND)');
    expect(executeQuery).toHaveBeenCalledTimes(1);
    expect(binds).toEqual({
      searchText: 'HABTT.BDH',
      searchLike: '%HABTT.BDH%',
    });
  });

  it('maps report definitions including SQL and TM parameters', async () => {
    const executeQuery = vi.fn().mockResolvedValueOnce([{
      BAOCAO_ID: 12,
      TEN_BC: 'Báo cáo doanh thu',
      STRING_SQL: 'SELECT * FROM doanh_thu WHERE ngay = :p_ngay',
      TM1: 'p_ngay',
      TM2: null,
      TM3: null,
      TM4: null,
      TM5: null,
      TM6: null,
      TM7: null,
      RPT_VIEW: 'doanh-thu',
      RPT_EXPORT: 'xlsx',
      NHOMBC_ID: 2,
      NHOM_BC: 'Kinh doanh',
      PROC_PK: null,
    }]);
    const repository = new AdminRepository({ executeQuery } as unknown as OracleService);

    const reports = await repository.findReports();

    expect(reports[0]).toMatchObject({
      id: '12',
      name: 'Báo cáo doanh thu',
      sql: 'SELECT * FROM doanh_thu WHERE ngay = :p_ngay',
      groupId: '2',
      groupName: 'Kinh doanh',
    });
    expect(reports[0]?.parameters).toEqual(['p_ngay', null, null, null, null, null, null]);
    expect(executeQuery.mock.calls[0]?.[2]).toMatchObject({
      fetchInfo: { STRING_SQL: expect.any(Object) },
    });
  });
});
