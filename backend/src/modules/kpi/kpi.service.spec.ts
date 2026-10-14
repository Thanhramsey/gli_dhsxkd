import { describe, expect, it, vi } from 'vitest';
import { OracleService } from '../../database/oracle.service.js';
import { KpiService } from './kpi.service.js';

describe('KpiService.trend', () => {
  it('maps the procedure pivot into monthly rows from January to the selected month', async () => {
    const executeProcedure = vi.fn().mockResolvedValue({
      outBinds: {
        P_RESULT: [{
          BIEUDO: 'MyTV',
          SL_TB_20260101: 10,
          DOANH_THU_20260101: 100,
          SL_TB_20260201: 20,
          DOANH_THU_20260201: null,
        }],
      },
    });
    const service = new KpiService({ executeProcedure } as unknown as OracleService);

    const result = await service.trend({ month: '2026-02', procedure: 'TONG_HOP_KPI_MYTV' });

    expect(result.rows).toEqual([
      { month: '2026-01', subscribers: 10, revenue: 100 },
      { month: '2026-02', subscribers: 20, revenue: null },
    ]);
    expect(executeProcedure).toHaveBeenCalledWith(
      'NBH_CDS_NEW.MA_KPI_GLI_TONG',
      'TONG_HOP_KPI_MYTV',
      expect.objectContaining({
        P_TUNGAY: expect.objectContaining({ val: '01/01/2026' }),
        P_DENNGAY: expect.objectContaining({ val: '28/02/2026' }),
      }),
    );
  });
});
