import { OracleService } from '../../database/oracle.service.js';
import { AuthRepository } from './auth.repository.js';

describe('AuthRepository', () => {
  it('maps LEVEL_ROLE to its group in GLI_NHOM_ND', async () => {
    const executeQuery = vi
      .fn()
      .mockResolvedValueOnce([
        {
          MA_ND: 'demo.user',
          NHANVIEN_ID: 201,
          TRANGTHAI: 1,
          MA_NV: 'NV201',
          TEN_NV: 'Nguyễn Văn Demo',
          CHUCDANH: 'Chuyên viên',
          EMAIL: 'demo@example.test',
          DONVI_ID: 301,
          MA_DV: 'DV01',
          TEN_DV: 'Đơn vị demo',
          LEVEL_ROLE: 0,
          NHOMND_ID: 0,
          TEN_NHOMND: 'Quản trị hệ thống',
        },
      ]);
    const repository = new AuthRepository({
      executeQuery,
    } as unknown as OracleService);

    const result = await repository.findByAccount('demo.user');

    expect(result?.groupIds).toEqual(['0']);
    expect(result?.groupId).toBe('0');
    expect(result?.groupName).toBe('Quản trị hệ thống');
    expect(executeQuery).toHaveBeenCalledTimes(1);
    expect(executeQuery.mock.calls[0]?.[0]).toContain('g.NHOMND_ID = u.LEVEL_ROLE');
    expect(executeQuery.mock.calls[0]?.[0]).toContain('GLI_NHOM_ND');
  });
});
