import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MenuService } from '../menu/menu.service.js';
import type { MenuItem } from '../menu/menu.types.js';
import { AdminRepository } from './admin.repository.js';
import type {
  AssignIdsDto,
  CreateGroupDto,
  CreateMenuDto,
  CreateUserDto,
  UpdateGroupDto,
  UpdateMenuDto,
  UpdateUserDto,
} from './dto/admin.dto.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly menuService: MenuService,
  ) {}

  users(search?: string) {
    return this.repository.findUsers(search);
  }

  employees(search?: string) {
    return this.repository.findEmployees(search);
  }

  async createUser(input: CreateUserDto): Promise<void> {
    const existing = (await this.repository.findUsers(input.account)).find(
      (user) => user.account.toUpperCase() === input.account.trim().toUpperCase(),
    );
    if (existing) throw new ConflictException('Mã người dùng đã tồn tại');
    await this.assertGroupsExist(input.groupIds);
    const affected = await this.repository.createUser({
      ...input,
      account: input.account.trim(),
    });
    if (!affected) throw new BadRequestException('Nhân viên được chọn không tồn tại');
  }

  async updateUser(id: string, input: UpdateUserDto): Promise<void> {
    const current = (await this.repository.findUsers(id)).find(
      (user) => user.id === id,
    );
    if (!current) throw new NotFoundException('Không tìm thấy người dùng');
    const groupIds = input.groupIds ?? current.groupIds;
    await this.assertGroupsExist(groupIds);
    const affected = await this.repository.updateUser(id, {
      employeeId: input.employeeId ?? current.employeeId,
      status: input.status ?? current.status,
      groupIds,
    });
    if (!affected) throw new NotFoundException('Không tìm thấy người dùng');
  }

  async deleteUser(id: string): Promise<void> {
    const current = (await this.repository.findUsers(id)).find(
      (user) => user.id === id,
    );
    if (!current) throw new NotFoundException('Không tìm thấy người dùng');
    await this.repository.deleteUser(current.account);
  }

  groups() {
    return this.repository.findGroups();
  }

  async createGroup(input: CreateGroupDto): Promise<void> {
    const duplicate = (await this.repository.findGroups()).some(
      (group) => group.name.toUpperCase() === input.name.trim().toUpperCase(),
    );
    if (duplicate) throw new ConflictException('Tên nhóm đã tồn tại');
    await this.repository.createGroup(input.name.trim());
  }

  async updateGroup(id: string, input: UpdateGroupDto): Promise<void> {
    const groups = await this.repository.findGroups();
    if (!groups.some((group) => group.id === id)) {
      throw new NotFoundException('Không tìm thấy nhóm người dùng');
    }
    if (
      groups.some(
        (group) =>
          group.id !== id &&
          group.name.toUpperCase() === input.name.trim().toUpperCase(),
      )
    ) {
      throw new ConflictException('Tên nhóm đã tồn tại');
    }
    await this.repository.updateGroup(id, input.name.trim());
  }

  async deleteGroup(id: string): Promise<void> {
    const affected = await this.repository.deleteGroup(id);
    if (!affected) throw new NotFoundException('Không tìm thấy nhóm người dùng');
  }

  async assignGroupMenus(id: string, input: AssignIdsDto): Promise<void> {
    if (!(await this.repository.findGroups()).some((group) => group.id === id)) {
      throw new NotFoundException('Không tìm thấy nhóm người dùng');
    }
    const validIds = new Set(this.flatten(await this.menuService.getCatalog()).map((menu) => menu.id));
    if (input.ids.some((menuId) => !validIds.has(menuId))) {
      throw new BadRequestException('Danh sách chứa menu không tồn tại');
    }
    await this.repository.assignGroupMenus(id, input.ids);
  }

  menuCatalog() {
    return this.menuService.getCatalog();
  }

  async createMenu(input: CreateMenuDto): Promise<void> {
    await this.assertParentMenu(input.parentId);
    await this.repository.createMenu(input);
  }

  async updateMenu(id: string, input: UpdateMenuDto): Promise<void> {
    const catalog = await this.menuService.getCatalog();
    const menus = this.flatten(catalog);
    const current = menus.find((menu) => menu.id === id);
    if (!current) throw new NotFoundException('Không tìm thấy menu');
    const parentId = input.parentId === undefined ? current.parentId : input.parentId || null;
    if (parentId === id) throw new BadRequestException('Menu không thể là cha của chính nó');
    const currentNode = this.findNode(catalog, id);
    if (parentId && currentNode && this.flatten(currentNode.children).some((menu) => menu.id === parentId)) {
      throw new BadRequestException('Không thể chuyển menu vào một menu con của nó');
    }
    await this.assertParentMenu(parentId ?? undefined);
    const affected = await this.repository.updateMenu(id, {
      name: input.name?.trim() ?? current.name,
      url: input.url === undefined ? current.path : input.url || null,
      parentId,
      orderIndex: input.orderIndex ?? current.orderNo,
      icon: input.icon === undefined ? current.icon : input.icon || null,
      isHeading: input.isHeading ?? current.isHeading,
    });
    if (!affected) throw new NotFoundException('Không tìm thấy menu');
  }

  async deleteMenu(id: string): Promise<void> {
    if (await this.repository.countMenuChildren(id)) {
      throw new ConflictException('Hãy xóa hoặc chuyển các menu con trước');
    }
    const affected = await this.repository.deleteMenu(id);
    if (!affected) throw new NotFoundException('Không tìm thấy menu');
  }

  private async assertGroupsExist(groupIds: string[]): Promise<void> {
    const existing = new Set((await this.repository.findGroups()).map((group) => group.id));
    if (groupIds.some((id) => !existing.has(id))) {
      throw new BadRequestException('Danh sách chứa nhóm người dùng không tồn tại');
    }
  }

  private async assertParentMenu(parentId?: string): Promise<void> {
    if (!parentId) return;
    const exists = this.flatten(await this.menuService.getCatalog()).some(
      (menu) => menu.id === parentId,
    );
    if (!exists) throw new BadRequestException('Menu cha không tồn tại');
  }

  private flatten(items: MenuItem[]): MenuItem[] {
    return items.flatMap((item) => [item, ...this.flatten(item.children)]);
  }

  private findNode(items: MenuItem[], id: string): MenuItem | undefined {
    for (const item of items) {
      if (item.id === id) return item;
      const child = this.findNode(item.children, id);
      if (child) return child;
    }
    return undefined;
  }
}
