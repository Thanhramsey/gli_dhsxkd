import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MenuService } from '../menu/menu.service.js';
import { AuthRepository, type UserRecord } from './auth.repository.js';
import { AuthService } from './auth.service.js';

const userRecord: UserRecord = {
  userId: '101',
  account: 'demo.user',
  displayName: 'Người dùng demo',
  groupIds: ['5', '7'],
  groupId: '5',
  groupName: 'Quản trị',
  status: '1',
  employeeId: '201',
  employeeCode: 'NV201',
  fullName: 'Nguyễn Văn Demo',
  title: 'Chuyên viên',
  phone: null,
  email: 'demo@example.test',
  unitId: '301',
  unitCode: 'DV01',
  unitName: 'Đơn vị demo',
  source: 'V_NGUOIDUNG_DIABAN',
};

describe('AuthService', () => {
  it('logs in by MA_ND and creates a session with menu permissions', async () => {
    const authRepository = {
      findByAccount: vi.fn().mockResolvedValue(userRecord),
    } as unknown as AuthRepository;
    const menuService = {
      getPermissionCodes: vi.fn().mockResolvedValue(['HOME', 'MENU_MANAGEMENT']),
    } as unknown as MenuService;
    const jwtService = {
      signAsync: vi.fn().mockResolvedValue('signed-token'),
    } as unknown as JwtService;
    const configService = {
      get: vi.fn().mockReturnValue(28_800),
    } as unknown as ConfigService;
    const service = new AuthService(
      authRepository,
      menuService,
      jwtService,
      configService,
    );

    const result = await service.login('demo.user');

    expect(authRepository.findByAccount).toHaveBeenCalledWith('demo.user');
    expect(menuService.getPermissionCodes).toHaveBeenCalledWith(['5', '7']);
    expect(result.token).toBe('signed-token');
    expect(result.user.employee.fullName).toBe('Nguyễn Văn Demo');
    expect(result.user.menuCodes).toEqual(['HOME', 'MENU_MANAGEMENT']);
  });
});
