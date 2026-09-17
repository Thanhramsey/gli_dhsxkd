import { MenuRepository, type MenuRow } from './menu.repository.js';
import { MenuService } from './menu.service.js';

function menu(overrides: Partial<MenuRow>): MenuRow {
  return {
    MENU_ID: '1',
    MENU_NAME: 'Trang chủ',
    MENU_URL: '/',
    MENU_CHA_ID: null,
    ORDER_INDEX: 1,
    MENU_ICON: null,
    IS_HEADING: 0,
    ...overrides,
  };
}

describe('MenuService', () => {
  it('builds an ordered GLI_MENU hierarchy', async () => {
    const repository = {
      findByGroupIds: vi.fn().mockResolvedValue([
        menu({
          MENU_ID: '2',
          MENU_CHA_ID: '1',
          MENU_NAME: 'Báo cáo',
          ORDER_INDEX: 2,
        }),
        menu({ MENU_ID: '1', MENU_NAME: 'Điều hành', IS_HEADING: 1 }),
      ]),
    } as unknown as MenuRepository;
    const service = new MenuService(repository);

    const result = await service.getMenuTree(['10']);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('1');
    expect(result[0]?.isHeading).toBe(true);
    expect(result[0]?.children.map((item) => item.id)).toEqual(['2']);
  });

  it('returns no permissions when a user has no group', async () => {
    const repository = { findByGroupIds: vi.fn() } as unknown as MenuRepository;
    const service = new MenuService(repository);

    await expect(service.getMenuTree([])).resolves.toEqual([]);
    expect(repository.findByGroupIds).not.toHaveBeenCalled();
  });

  it('uses MENU_ID as the permission code', async () => {
    const repository = {
      findByGroupIds: vi.fn().mockResolvedValue([
        menu({ MENU_ID: '100' }),
        menu({ MENU_ID: '100' }),
        menu({ MENU_ID: '200' }),
      ]),
    } as unknown as MenuRepository;
    const service = new MenuService(repository);

    await expect(service.getPermissionCodes(['10', '20'])).resolves.toEqual([
      '100',
      '200',
    ]);
    expect(repository.findByGroupIds).toHaveBeenCalledWith(['10', '20']);
  });
});
