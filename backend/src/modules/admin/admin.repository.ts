import { Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../../database/oracle.service.js';
import type { AdminGroup, AdminUser, EmployeeOption } from './admin.types.js';

interface UserRow {
  MA_ND: unknown;
  TEN_ND: unknown;
  NHANVIEN_ID: unknown;
  TRANGTHAI: unknown;
  MA_NV: unknown;
  TEN_NV: unknown;
  TEN_DV: unknown;
}

interface MembershipRow {
  MA_ND: unknown;
  NHOMND_ID: unknown;
  TEN_NHOMND: unknown;
}

interface GroupRow {
  NHOMND_ID: unknown;
  TEN_NHOMND: unknown;
  USER_COUNT: unknown;
}

interface GroupMenuRow {
  NHOMND_ID: unknown;
  MENU_ID: unknown;
}

interface EmployeeRow {
  NHANVIEN_ID: unknown;
  MA_NV: unknown;
  TEN_NV: unknown;
  TEN_DV: unknown;
}

@Injectable()
export class AdminRepository {
  constructor(private readonly oracleService: OracleService) {}

  async findUsers(search = ''): Promise<AdminUser[]> {
    const normalizedSearch = search.trim().toUpperCase();
    const rows = await this.oracleService.executeQuery<UserRow>(
      `SELECT * FROM (
         SELECT u.MA_ND, NVL(nv.TEN_NV, u.TEN_NV) AS TEN_ND,
                u.NHANVIEN_ID, u.TRANGTHAI,
                NVL(nv.MA_NV, u.MA_NV) AS MA_NV,
                NVL(nv.TEN_NV, u.TEN_NV) AS TEN_NV, dv.TEN_DV
           FROM V_NGUOIDUNG_DIABAN u
           LEFT JOIN V_NHANVIEN nv ON nv.NHANVIEN_ID = u.NHANVIEN_ID
           LEFT JOIN V_DONVI dv ON dv.DONVI_ID = NVL(nv.DONVI_ID, u.DONVI_ID)
          WHERE :searchText IS NULL
             OR UPPER(u.MA_ND) LIKE :searchLike
             OR UPPER(u.TEN_ND) LIKE :searchLike
             OR UPPER(nv.TEN_NV) LIKE :searchLike
          ORDER BY u.MA_ND
       ) WHERE ROWNUM <= 500`,
      {
        searchText: normalizedSearch || null,
        searchLike: normalizedSearch ? `%${normalizedSearch}%` : null,
      },
    );
    const memberships = await this.oracleService.executeQuery<MembershipRow>(
      `SELECT ung.MA_ND, ung.NHOMND_ID, g.TEN_NHOMND
         FROM V_NGUOIDUNG_NHOMND ung
         LEFT JOIN GLI_NHOM_ND g ON g.NHOMND_ID = ung.NHOMND_ID
        ORDER BY ung.MA_ND, g.TEN_NHOMND`,
    );
    const byAccount = new Map<string, MembershipRow[]>();
    for (const membership of memberships) {
      const account = this.text(membership.MA_ND);
      byAccount.set(account, [...(byAccount.get(account) ?? []), membership]);
    }
    return rows.map((row) => {
      const assigned = byAccount.get(this.text(row.MA_ND)) ?? [];
      return {
        id: this.text(row.MA_ND),
        account: this.text(row.MA_ND),
        displayName: this.text(row.TEN_ND),
        employeeId: this.text(row.NHANVIEN_ID),
        employeeCode: this.nullableText(row.MA_NV),
        employeeName: this.nullableText(row.TEN_NV),
        unitName: this.nullableText(row.TEN_DV),
        status: Number(row.TRANGTHAI ?? 0),
        groupIds: assigned.map((item) => this.text(item.NHOMND_ID)),
        groupNames: assigned.map(
          (item) =>
            this.nullableText(item.TEN_NHOMND) ?? this.text(item.NHOMND_ID),
        ),
      };
    });
  }

  async findEmployees(search = ''): Promise<EmployeeOption[]> {
    const normalizedSearch = search.trim().toUpperCase();
    const rows = await this.oracleService.executeQuery<EmployeeRow>(
      `SELECT * FROM (
         SELECT nv.NHANVIEN_ID, nv.MA_NV, nv.TEN_NV, dv.TEN_DV
           FROM V_NHANVIEN nv
           LEFT JOIN V_DONVI dv ON dv.DONVI_ID = nv.DONVI_ID
          WHERE :searchText IS NULL
             OR UPPER(nv.MA_NV) LIKE :searchLike
             OR UPPER(nv.TEN_NV) LIKE :searchLike
          ORDER BY nv.TEN_NV
       ) WHERE ROWNUM <= 100`,
      {
        searchText: normalizedSearch || null,
        searchLike: normalizedSearch ? `%${normalizedSearch}%` : null,
      },
    );
    return rows.map((row) => ({
      id: this.text(row.NHANVIEN_ID),
      code: this.text(row.MA_NV),
      name: this.text(row.TEN_NV),
      unitName: this.nullableText(row.TEN_DV),
    }));
  }

  async createUser(input: {
    account: string;
    employeeId: string;
    status: number;
    groupIds: string[];
  }): Promise<number> {
    return this.oracleService.withTransaction(async (connection) => {
      const result = await connection.execute(
        `INSERT INTO V_NGUOIDUNG_DIABAN
          (MA_ND, MA_NV, TEN_NV, MATKHAU, DONVI_ID, MA_DV, NHANVIEN_ID, TRANGTHAI)
         SELECT :account, nv.MA_NV, nv.TEN_NV, :password,
                nv.DONVI_ID, dv.MA_DV, nv.NHANVIEN_ID, :status
           FROM V_NHANVIEN nv
           JOIN V_DONVI dv ON dv.DONVI_ID = nv.DONVI_ID
          WHERE nv.NHANVIEN_ID = :employeeId`,
        {
          account: input.account,
          password: 'SSO_PENDING',
          employeeId: input.employeeId,
          status: input.status,
        },
      );
      if (!result.rowsAffected) return 0;
      await this.replaceUserGroups(connection, input.account, input.groupIds);
      return result.rowsAffected;
    });
  }

  async updateUser(
    account: string,
    input: {
      employeeId: string;
      status: number;
      groupIds: string[];
    },
  ): Promise<number> {
    return this.oracleService.withTransaction(async (connection) => {
      const result = await connection.execute(
        `UPDATE V_NGUOIDUNG_DIABAN u
            SET (MA_NV, TEN_NV, DONVI_ID, MA_DV, NHANVIEN_ID, TRANGTHAI) =
                (SELECT nv.MA_NV, nv.TEN_NV, nv.DONVI_ID, dv.MA_DV,
                        nv.NHANVIEN_ID, :status
                   FROM V_NHANVIEN nv
                   JOIN V_DONVI dv ON dv.DONVI_ID = nv.DONVI_ID
                  WHERE nv.NHANVIEN_ID = :employeeId)
          WHERE UPPER(TRIM(u.MA_ND)) = UPPER(TRIM(:account))
            AND EXISTS (SELECT 1 FROM V_NHANVIEN nv
                         WHERE nv.NHANVIEN_ID = :employeeId)`,
        {
          account,
          employeeId: input.employeeId,
          status: input.status,
        },
      );
      if (result.rowsAffected) {
        await this.replaceUserGroups(connection, account, input.groupIds);
      }
      return result.rowsAffected ?? 0;
    });
  }

  async deleteUser(account: string): Promise<number> {
    return this.oracleService.withTransaction(async (connection) => {
      await connection.execute(
        'DELETE FROM V_NGUOIDUNG_NHOMND WHERE MA_ND = :account',
        { account },
      );
      const result = await connection.execute(
        'DELETE FROM V_NGUOIDUNG_DIABAN WHERE MA_ND = :account',
        { account },
      );
      return result.rowsAffected ?? 0;
    });
  }

  async findGroups(): Promise<AdminGroup[]> {
    const [groups, assignments] = await Promise.all([
      this.oracleService.executeQuery<GroupRow>(
        `SELECT g.NHOMND_ID, g.TEN_NHOMND,
                (SELECT COUNT(*) FROM V_NGUOIDUNG_NHOMND ung
                  WHERE ung.NHOMND_ID = g.NHOMND_ID) AS USER_COUNT
           FROM GLI_NHOM_ND g
          ORDER BY g.TEN_NHOMND`,
      ),
      this.oracleService.executeQuery<GroupMenuRow>(
        `SELECT NHOMND_ID, MENU_ID
           FROM GLI_NHOM_ND_MENU
          ORDER BY NHOMND_ID, MENU_ID`,
      ),
    ]);
    const menuIds = new Map<string, string[]>();
    for (const row of assignments) {
      const groupId = this.text(row.NHOMND_ID);
      menuIds.set(groupId, [
        ...(menuIds.get(groupId) ?? []),
        this.text(row.MENU_ID),
      ]);
    }
    return groups.map((row) => ({
      id: this.text(row.NHOMND_ID),
      name: this.text(row.TEN_NHOMND),
      menuIds: menuIds.get(this.text(row.NHOMND_ID)) ?? [],
      userCount: Number(row.USER_COUNT ?? 0),
    }));
  }

  async createGroup(name: string): Promise<void> {
    await this.oracleService.withTransaction(async (connection) => {
      await connection.execute('LOCK TABLE GLI_NHOM_ND IN EXCLUSIVE MODE');
      const idResult = await connection.execute<{ NEXT_ID: number }>(
        'SELECT NVL(MAX(NHOMND_ID), 0) + 1 AS NEXT_ID FROM GLI_NHOM_ND',
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      await connection.execute(
        'INSERT INTO GLI_NHOM_ND (NHOMND_ID, TEN_NHOMND) VALUES (:id, :name)',
        { id: idResult.rows?.[0]?.NEXT_ID, name },
      );
    });
  }

  updateGroup(id: string, name: string): Promise<number> {
    return this.oracleService.executeMutation(
      'UPDATE GLI_NHOM_ND SET TEN_NHOMND = :name WHERE NHOMND_ID = :id',
      { id, name },
    );
  }

  deleteGroup(id: string): Promise<number> {
    return this.oracleService.withTransaction(async (connection) => {
      await connection.execute(
        'DELETE FROM GLI_NHOM_ND_MENU WHERE NHOMND_ID = :id',
        { id },
      );
      await connection.execute(
        'DELETE FROM V_NGUOIDUNG_NHOMND WHERE NHOMND_ID = :id',
        { id },
      );
      const result = await connection.execute(
        'DELETE FROM GLI_NHOM_ND WHERE NHOMND_ID = :id',
        { id },
      );
      return result.rowsAffected ?? 0;
    });
  }

  assignGroupMenus(groupId: string, menuIds: string[]): Promise<void> {
    return this.oracleService.withTransaction(async (connection) => {
      await connection.execute(
        'DELETE FROM GLI_NHOM_ND_MENU WHERE NHOMND_ID = :groupId',
        { groupId },
      );
      for (const menuId of menuIds) {
        await connection.execute(
          `INSERT INTO GLI_NHOM_ND_MENU (NHOMND_ID, MENU_ID)
           VALUES (:groupId, :menuId)`,
          { groupId, menuId },
        );
      }
    });
  }

  async createMenu(input: {
    name: string;
    url?: string;
    parentId?: string;
    orderIndex?: number;
    icon?: string;
    isHeading: boolean;
  }): Promise<void> {
    await this.oracleService.withTransaction(async (connection) => {
      const idResult = await connection.execute<{ NEXT_ID: number }>(
        'SELECT SEQ_MENU.NEXTVAL AS NEXT_ID FROM DUAL',
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      await connection.execute(
        `INSERT INTO GLI_MENU
          (MENU_ID, MENU_NAME, MENU_URL, MENU_CHA_ID, ORDER_INDEX, MENU_ICON, IS_HEADING)
         VALUES (:id, :name, :url, :parentId, :orderIndex, :icon, :isHeading)`,
        {
          id: idResult.rows?.[0]?.NEXT_ID,
          name: input.name,
          url: input.url || null,
          parentId: input.parentId || null,
          orderIndex: input.orderIndex ?? 0,
          icon: input.icon || null,
          isHeading: input.isHeading ? 1 : 0,
        },
      );
    });
  }

  updateMenu(
    id: string,
    input: {
      name: string;
      url: string | null;
      parentId: string | null;
      orderIndex: number;
      icon: string | null;
      isHeading: boolean;
    },
  ): Promise<number> {
    return this.oracleService.executeMutation(
      `UPDATE GLI_MENU
          SET MENU_NAME = :name, MENU_URL = :url, MENU_CHA_ID = :parentId,
              ORDER_INDEX = :orderIndex, MENU_ICON = :icon,
              IS_HEADING = :isHeading
        WHERE MENU_ID = :id`,
      {
        id,
        name: input.name,
        url: input.url,
        parentId: input.parentId,
        orderIndex: input.orderIndex,
        icon: input.icon,
        isHeading: input.isHeading ? 1 : 0,
      },
    );
  }

  async countMenuChildren(id: string): Promise<number> {
    const rows = await this.oracleService.executeQuery<{ TOTAL: number }>(
      'SELECT COUNT(*) AS TOTAL FROM GLI_MENU WHERE MENU_CHA_ID = :id',
      { id },
    );
    return Number(rows[0]?.TOTAL ?? 0);
  }

  deleteMenu(id: string): Promise<number> {
    return this.oracleService.withTransaction(async (connection) => {
      await connection.execute(
        'DELETE FROM GLI_NHOM_ND_MENU WHERE MENU_ID = :id',
        { id },
      );
      const result = await connection.execute(
        'DELETE FROM GLI_MENU WHERE MENU_ID = :id',
        { id },
      );
      return result.rowsAffected ?? 0;
    });
  }

  private async replaceUserGroups(
    connection: oracledb.Connection,
    account: string,
    groupIds: string[],
  ): Promise<void> {
    await connection.execute(
      'DELETE FROM V_NGUOIDUNG_NHOMND WHERE MA_ND = :account',
      { account },
    );
    for (const groupId of groupIds) {
      await connection.execute(
        `INSERT INTO V_NGUOIDUNG_NHOMND (MA_ND, NHOMND_ID)
         VALUES (:account, :groupId)`,
        { account, groupId },
      );
    }
  }

  private text(value: unknown): string {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  private nullableText(value: unknown): string | null {
    return this.text(value) || null;
  }
}
