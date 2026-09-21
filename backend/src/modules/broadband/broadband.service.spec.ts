import oracledb from 'oracledb';
import type { OracleService } from '../../database/oracle.service.js';
import { BroadbandService } from './broadband.service.js';

describe('BroadbandService', () => {
  it('uses an allowlisted procedure and typed bind variables', async () => {
    const executeProcedure = vi.fn().mockResolvedValue({
      outBinds: { P_CURSOR: [{ 'Tên đơn vị phát triển': 'TỔNG', Fiber: 12 }] },
    });
    const service = new BroadbandService({
      executeProcedure,
    } as unknown as OracleService);

    const result = await service.execute('ptm-employee', {
      fromDate: '2026-09-01',
      toDate: '2026-09-21',
      unitId: 0,
      serviceId: 0,
      subscriberTypeId: 0,
      areaId: 0,
    });

    expect(executeProcedure).toHaveBeenCalledWith(
      'NBH_CDS_NEW.PACK_BR',
      'TONGHOP_PTM_NV',
      expect.objectContaining({
        P_FROM: expect.objectContaining({ val: '20260901', type: oracledb.STRING }),
        P_TO: expect.objectContaining({ val: '20260921', type: oracledb.STRING }),
        P_DONVI: expect.objectContaining({ val: 0, type: oracledb.NUMBER }),
        P_DICHVU: expect.objectContaining({ val: 0, type: oracledb.NUMBER }),
        P_LOAITB: expect.objectContaining({ val: 0, type: oracledb.NUMBER }),
        P_CURSOR: expect.objectContaining({
          dir: oracledb.BIND_OUT,
          type: oracledb.CURSOR,
        }),
      }),
    );
    expect(result.rows).toHaveLength(1);
  });

  it('includes the area bind only for area procedures', async () => {
    const executeProcedure = vi.fn().mockResolvedValue({
      outBinds: { P_CURSOR: [] },
    });
    const service = new BroadbandService({
      executeProcedure,
    } as unknown as OracleService);

    await service.execute('cancel-area', {
      fromDate: '2026-09-01',
      toDate: '2026-09-21',
      unitId: 0,
      serviceId: 0,
      subscriberTypeId: 0,
      areaId: 0,
    });

    expect(executeProcedure.mock.calls[0]?.[2]).toHaveProperty('P_KHUVUC');
  });

  it('rejects procedure names outside the server allowlist', async () => {
    const executeProcedure = vi.fn();
    const service = new BroadbandService({
      executeProcedure,
    } as unknown as OracleService);

    await expect(service.execute('PACK_BR.DELETE_DATA', {
      fromDate: '2026-09-01',
      toDate: '2026-09-21',
      unitId: 0,
      serviceId: 0,
      subscriberTypeId: 0,
      areaId: 0,
    })).rejects.toThrow('Không tìm thấy báo cáo băng rộng');
    expect(executeProcedure).not.toHaveBeenCalled();
  });
});
