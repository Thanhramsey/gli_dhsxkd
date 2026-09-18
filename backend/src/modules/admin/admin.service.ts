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
  CreateReportDto,
  CreateReportGroupDto,
  CreateUserDto,
  UpdateGroupDto,
  UpdateMenuDto,
  UpdateReportDto,
  UpdateReportGroupDto,
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

  reportGroups() {
    return this.repository.findReportGroups();
  }

  async createReportGroup(input: CreateReportGroupDto): Promise<void> {
    const name = input.name.trim();
    if ((await this.repository.findReportGroups()).some(
      (group) => group.name.toUpperCase() === name.toUpperCase(),
    )) {
      throw new ConflictException('Tên nhóm báo cáo đã tồn tại');
    }
    await this.repository.createReportGroup({ name, note: input.note?.trim() });
  }

  async updateReportGroup(
    id: string,
    input: UpdateReportGroupDto,
  ): Promise<void> {
    const groups = await this.repository.findReportGroups();
    const current = groups.find((group) => group.id === id);
    if (!current) throw new NotFoundException('Không tìm thấy nhóm báo cáo');
    const name = input.name?.trim() ?? current.name;
    if (groups.some(
      (group) => group.id !== id && group.name.toUpperCase() === name.toUpperCase(),
    )) {
      throw new ConflictException('Tên nhóm báo cáo đã tồn tại');
    }
    const affected = await this.repository.updateReportGroup(id, {
      name,
      note: input.note === undefined ? current.note ?? undefined : input.note.trim(),
    });
    if (!affected) throw new NotFoundException('Không tìm thấy nhóm báo cáo');
  }

  async deleteReportGroup(id: string): Promise<void> {
    if (await this.repository.countReportsInGroup(id)) {
      throw new ConflictException('Không thể xóa nhóm đang có báo cáo');
    }
    const affected = await this.repository.deleteReportGroup(id);
    if (!affected) throw new NotFoundException('Không tìm thấy nhóm báo cáo');
  }

  reports(search?: string, groupId?: string) {
    return this.repository.findReports(search, groupId);
  }

  async createReport(input: CreateReportDto): Promise<void> {
    await this.assertReportGroupExists(input.groupId);
    await this.repository.createReport(this.normalizeReport(input));
  }

  async updateReport(id: string, input: UpdateReportDto): Promise<void> {
    if (!(await this.repository.reportExists(id))) {
      throw new NotFoundException('Không tìm thấy báo cáo');
    }
    await this.assertReportGroupExists(input.groupId);
    const affected = await this.repository.updateReport(id, this.normalizeReport(input));
    if (!affected) throw new NotFoundException('Không tìm thấy báo cáo');
  }

  async deleteReport(id: string): Promise<void> {
    const affected = await this.repository.deleteReport(id);
    if (!affected) throw new NotFoundException('Không tìm thấy báo cáo');
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

  private async assertReportGroupExists(groupId?: string): Promise<void> {
    if (!groupId) return;
    if (!(await this.repository.findReportGroups()).some((group) => group.id === groupId)) {
      throw new BadRequestException('Nhóm báo cáo không tồn tại');
    }
  }

  private normalizeReport(input: CreateReportDto | UpdateReportDto) {
    return {
      name: input.name.trim(),
      sql: input.sql?.trim(),
      tm1: input.tm1?.trim(),
      tm2: input.tm2?.trim(),
      tm3: input.tm3?.trim(),
      tm4: input.tm4?.trim(),
      tm5: input.tm5?.trim(),
      tm6: input.tm6?.trim(),
      tm7: input.tm7?.trim(),
      reportView: input.reportView?.trim(),
      reportExport: input.reportExport?.trim(),
      groupId: input.groupId?.trim(),
      procedurePackage: input.procedurePackage?.trim(),
    };
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
