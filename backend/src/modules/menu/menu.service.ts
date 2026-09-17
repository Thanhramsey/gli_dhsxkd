import { Injectable } from '@nestjs/common';
import { MenuRepository, MenuRow } from './menu.repository.js';
import { MenuItem, UserGroup } from './menu.types.js';

@Injectable()
export class MenuService {
  constructor(private readonly menuRepository: MenuRepository) {}

  async getMenuTree(groupIds: string[]): Promise<MenuItem[]> {
    if (!groupIds.length) return [];
    return this.buildTree(await this.menuRepository.findByGroupIds(groupIds));
  }

  async getPermissionCodes(groupIds: string[]): Promise<string[]> {
    const rows = await this.menuRepository.findByGroupIds(groupIds);
    return [
      ...new Set(
        rows
          .map((row) => this.text(row.MENU_ID))
          .filter(Boolean),
      ),
    ];
  }

  async getCatalog(): Promise<MenuItem[]> {
    return this.buildTree(await this.menuRepository.findAll());
  }

  async getGroups(): Promise<UserGroup[]> {
    const rows = await this.menuRepository.findGroups();
    return rows.map((row) => ({
      id: this.text(row.NHOMND_ID),
      name: this.text(row.TEN_NHOMND) || this.text(row.NHOMND_ID),
    }));
  }

  private buildTree(rows: MenuRow[]): MenuItem[] {
    const nodes = [
      ...new Map(
        rows.map((row) => {
          const node = this.mapRow(row);
          return [node.id, node];
        }),
      ).values(),
    ];
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const roots: MenuItem[] = [];

    for (const node of nodes) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent && parent.id !== node.id) parent.children.push(node);
      else roots.push(node);
    }

    const sort = (items: MenuItem[]) => {
      items.sort(
        (left, right) =>
          left.orderNo - right.orderNo ||
          left.title.localeCompare(right.title, 'vi'),
      );
      items.forEach((item) => sort(item.children));
    };
    sort(roots);
    return roots;
  }

  private mapRow(row: MenuRow): MenuItem {
    const id = this.text(row.MENU_ID);
    const name = this.text(row.MENU_NAME) || id;
    return {
      id,
      parentId: this.nullableText(row.MENU_CHA_ID),
      name,
      title: name,
      code: id,
      path: this.nullableText(row.MENU_URL),
      component: null,
      redirect: null,
      icon: this.nullableText(row.MENU_ICON),
      orderNo: this.number(row.ORDER_INDEX, 999999),
      status: null,
      show: null,
      affix: null,
      isHeading: this.isTrue(row.IS_HEADING),
      children: [],
    };
  }

  private isTrue(value: unknown): boolean {
    return ['1', 'Y', 'YES', 'TRUE'].includes(this.text(value).toUpperCase());
  }

  private number(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private text(value: unknown): string {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  private nullableText(value: unknown): string | null {
    return this.text(value) || null;
  }
}
