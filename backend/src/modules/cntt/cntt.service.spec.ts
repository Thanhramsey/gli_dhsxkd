import oracledb from 'oracledb';
import type { OracleService } from '../../database/oracle.service.js';
import { CnttService } from './cntt.service.js';

describe('CnttService', () => {
  it('calls the fixed CNTT procedure with typed binds for the selected month', async () => {
    const executeProcedure = vi.fn().mockResolvedValue({
      outBinds: {
        P_CURSOR: [{
          DONVI_ID: 12,
          TEN_DV: 'VNPT An Khê',
          KE_HOACH: 100,
          'DOANH THU NHÓM A': 20,
          'DOANH THU NHÓM B,C': 10,
          'DOANH THU': 30,
          'DOANH THU TBỊ NHÓM A': 5,
          'DOANH THU TBỊ NHÓM B,C': 2,
          'DOANH THU TBỊ': 7,
          DT_THUCHIEN: 45,
          TY_LE: 45,
          STT: 0,
        }],
      },
    });
    const service = new CnttService({ executeProcedure } as unknown as OracleService);

    const result = await service.revenue({ month: '2028-02' });

    expect(executeProcedure).toHaveBeenCalledWith(
      'NBH_CDS_NEW.PACK_CNTT',
      'TONGHOP_DOANHTHU_CNTT',
      expect.objectContaining({
        P_FROM: expect.objectContaining({ val: '01/02/2028', type: oracledb.STRING }),
        P_TO: expect.objectContaining({ val: '29/02/2028', type: oracledb.STRING }),
        P_DONVI: expect.objectContaining({ val: 0, type: oracledb.NUMBER }),
        P_DICHVU: expect.objectContaining({ val: 0, type: oracledb.NUMBER }),
        P_LOAITB: expect.objectContaining({ val: 0, type: oracledb.NUMBER }),
        P_CURSOR: expect.objectContaining({ dir: oracledb.BIND_OUT, type: oracledb.CURSOR }),
      }),
    );
    expect(result.rows).toEqual([{
      unitId: 12,
      unitName: 'VNPT An Khê',
      plan: 100,
      serviceGroupA: 20,
      serviceGroupBC: 10,
      serviceRevenue: 30,
      equipmentGroupA: 5,
      equipmentGroupBC: 2,
      equipmentRevenue: 7,
      actual: 45,
      completionRate: 45,
      isTotal: false,
    }]);
  });

  it('rejects invalid months before accessing Oracle', async () => {
    const executeProcedure = vi.fn();
    const service = new CnttService({ executeProcedure } as unknown as OracleService);

    await expect(service.revenue({ month: '2026-13' })).rejects.toThrow();
    expect(executeProcedure).not.toHaveBeenCalled();
  });
});
