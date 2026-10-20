import { describe, expect, it, vi } from 'vitest';
import { OracleService } from '../../database/oracle.service.js';
import { KpiService } from './kpi.service.js';

describe('KpiService.trend', () => {
  it('maps the procedure pivot into monthly rows from January to the selected month', async () => {
    const executeProcedure = vi.fn().mockResolvedValue({
      outBinds: {
        P_RESULT: [{
          BIEUDO: 'Vina trả sau',
          SL_TB_20260101: 10,
          DOANH_THU_20260101: 100,
          SL_TB_20260201: 20,
          DOANH_THU_20260201: null,
        }],
      },
    });
    const service = new KpiService({ executeProcedure } as unknown as OracleService);

    const result = await service.trend({ month: '2026-02', procedure: 'TONG_HOP_KPI_VINA_TS' });

    expect(result.rows).toEqual([
      { month: '2026-01', subscribers: 10, revenue: 100 },
      { month: '2026-02', subscribers: 20, revenue: null },
    ]);
    expect(executeProcedure).toHaveBeenCalledWith(
      'NBH_CDS_NEW.MA_KPI_GLI_TONG',
      'TONG_HOP_KPI_VINA_TS',
      expect.objectContaining({
        P_TUNGAY: expect.objectContaining({ val: '01/01/2026' }),
        P_DENNGAY: expect.objectContaining({ val: '28/02/2026' }),
      }),
    );
  });

  it.each([
    ['TONG_HOP_KPI_BRCD', 'F1.FIBER_C2'],
    ['TONG_HOP_KPI_MYTV', 'F1.MYTV_C2'],
    ['TONG_HOP_KPI_TSL', 'F1.DITT_C2'],
    ['TONG_HOP_KPI_CNTT', 'F4.1_C2'],
  ] as const)('reads %s from the selected snapshot without invoking a procedure', async (procedure, kpi) => {
    const executeQuery = vi.fn().mockResolvedValue([{
      THANG: '202609', KY_CUOC: 20260901, THANG_DULIEU: '202609', KPI: kpi,
      DOANH_THU: 200, KE_HOACH_THANG: 20, TY_LE_THANG: 1000,
      DOANH_THU_LK: 1500, KE_HOACH_LK_THANG: 180, TY_LE_LK_THANG: 833.33,
      KE_HOACH_LK_NAM: 240, TY_LE_LK_NAM: 625,
    }]);
    const executeProcedure = vi.fn();
    const service = new KpiService({ executeQuery, executeProcedure } as unknown as OracleService);
    const result = await service.trend({ month: '2026-09', procedure });

    expect(executeProcedure).not.toHaveBeenCalled();
    expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('FROM NBH_CDS_NEW.TONGHOP_KPI'), expect.objectContaining({
      KPI: expect.objectContaining({ val: kpi }),
      THANG_DULIEU: expect.objectContaining({ val: '202609' }),
    }));
    expect(result.rows).toEqual([expect.objectContaining({
      month: '2026-09', snapshotMonth: '2026-09', revenue: 200, plan: 20, completionRate: 1000,
      cumulativeRevenue: 1500, cumulativePlan: 180, cumulativeRate: 833.33, annualPlan: 240, annualRate: 625,
    })]);
  });

  it('chooses the latest snapshot for CNTT independently of the other KPIs', async () => {
    const executeQuery = vi.fn().mockResolvedValue([{ LATEST_MONTH: '202609' }]);
    const service = new KpiService({ executeQuery } as unknown as OracleService);
    expect(await service.latestMonth('TONG_HOP_KPI_CNTT')).toEqual({ month: '2026-09' });
    expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE KPI = :KPI'), expect.objectContaining({
      KPI: expect.objectContaining({ val: 'F4.1_C2' }),
    }));
  });

  it('keeps missing snapshot metrics null and uses the billing period when THANG is absent', async () => {
    const executeQuery = vi.fn().mockResolvedValue([{ THANG: null, KY_CUOC: 20260301, THANG_DULIEU: '202609' }]);
    const service = new KpiService({ executeQuery } as unknown as OracleService);
    expect((await service.trend({ month: '2026-09', procedure: 'TONG_HOP_KPI_TSL' })).rows).toEqual([
      expect.objectContaining({ month: '2026-03', revenue: null, plan: null, completionRate: null, annualRate: null }),
    ]);
    executeQuery.mockResolvedValue([]);
    expect((await service.trend({ month: '2026-10', procedure: 'TONG_HOP_KPI_TSL' })).rows).toEqual([]);
  });
});
