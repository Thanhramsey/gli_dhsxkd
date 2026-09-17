import { OracleService } from '../../database/oracle.service.js';
import { AuthRepository } from './auth.repository.js';

describe('AuthRepository', () => {
  it('loads all user groups from V_NGUOIDUNG_NHOMND and GLI_NHOM_ND', async () => {
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
          LEVEL_ROLE: 1,
        },
      ])
      .mockResolvedValueOnce([
        { NHOMND_ID: 1, TEN_NHOMND: 'Quản trị hệ thống' },
        { NHOMND_ID: 2, TEN_NHOMND: 'Lãnh đạo VTT' },
      ]);
    const repository = new AuthRepository({
      executeQuery,
    } as unknown as OracleService);

    const result = await repository.findByAccount('demo.user');

    expect(result?.groupIds).toEqual(['1', '2']);
    expect(result?.groupId).toBe('1');
    expect(result?.groupName).toBe('Quản trị hệ thống, Lãnh đạo VTT');
    expect(executeQuery).toHaveBeenCalledTimes(2);
    expect(executeQuery.mock.calls[1]?.[0]).toContain('V_NGUOIDUNG_NHOMND');
    expect(executeQuery.mock.calls[1]?.[0]).toContain('GLI_NHOM_ND');
  });
});
