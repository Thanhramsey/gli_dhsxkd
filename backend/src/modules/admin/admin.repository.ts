import { Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../../database/oracle.service.js';
import type {
  AdminGroup,
  AdminUser,
  EmployeeOption,
  ReportDefinition,
  ReportGroup,
} from './admin.types.js';

interface UserRow {
  MA_ND: unknown;
  TEN_ND: unknown;
  NHANVIEN_ID: unknown;
  TRANGTHAI: unknown;
  MA_NV: unknown;
  TEN_NV: unknown;
  TEN_DV: unknown;
  LEVEL_ROLE: unknown;
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

interface ReportGroupRow {
  NHOMBC_ID: unknown;
  NHOM_BC: unknown;
  GHICHU: unknown;
  REPORT_COUNT: unknown;
}

interface ReportRow {
  BAOCAO_ID: unknown;
  TEN_BC: unknown;
  STRING_SQL: unknown;
  TM1: unknown;
  TM2: unknown;
  TM3: unknown;
  TM4: unknown;
  TM5: unknown;
  TM6: unknown;
  TM7: unknown;
  RPT_VIEW: unknown;
  RPT_EXPORT: unknown;
  NHOMBC_ID: unknown;
  NHOM_BC: unknown;
  PROC_PK: unknown;
}

@Injectable()
export class AdminRepository {
  constructor(private readonly oracleService: OracleService) {}

  async findUsers(search = ''): Promise<AdminUser[]> {
    const normalizedSearch = search.trim().toUpperCase();
    const rows = await this.oracleService.executeQuery<UserRow>(
      `SELECT * FROM (
         SELECT u.MA_ND, NVL(nv.TEN_NV, u.TEN_NV) AS TEN_ND,
                u.NHANVIEN_ID, u.TRANGTHAI, u.LEVEL_ROLE,
                NVL(nv.MA_NV, u.MA_NV) AS MA_NV,
                NVL(nv.TEN_NV, u.TEN_NV) AS TEN_NV, dv.TEN_DV,
                g.NHOMND_ID, g.TEN_NHOMND
           FROM V_NGUOIDUNG_DIABAN u
           LEFT JOIN V_NHANVIEN nv ON nv.NHANVIEN_ID = u.NHANVIEN_ID
           LEFT JOIN V_DONVI dv ON dv.DONVI_ID = NVL(nv.DONVI_ID, u.DONVI_ID)
           LEFT JOIN GLI_NHOM_ND g ON g.NHOMND_ID = u.LEVEL_ROLE
          WHERE :searchText IS NULL
             OR UPPER(u.MA_ND) LIKE :searchLike
             OR UPPER(u.TEN_NV) LIKE :searchLike
             OR UPPER(nv.TEN_NV) LIKE :searchLike
          ORDER BY u.MA_ND
       ) WHERE ROWNUM <= 500`,
      {
        searchText: normalizedSearch || null,
        searchLike: normalizedSearch ? `%${normalizedSearch}%` : null,
      },
    );
    return rows.map((row) => {
      const groupId = this.nullableText(row.NHOMND_ID);
      return {
        id: this.text(row.MA_ND),
        account: this.text(row.MA_ND),
        displayName: this.text(row.TEN_ND),
        employeeId: this.text(row.NHANVIEN_ID),
        employeeCode: this.nullableText(row.MA_NV),
        employeeName: this.nullableText(row.TEN_NV),
        unitName: this.nullableText(row.TEN_DV),
        status: Number(row.TRANGTHAI ?? 0),
        groupIds: groupId ? [groupId] : [],
        groupNames: groupId
          ? [this.nullableText(row.TEN_NHOMND) ?? groupId]
          : [],
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
          (MA_ND, MA_NV, TEN_NV, MATKHAU, DONVI_ID, MA_DV,
           NHANVIEN_ID, TRANGTHAI, LEVEL_ROLE)
         SELECT :account, nv.MA_NV, nv.TEN_NV, :password,
                nv.DONVI_ID, dv.MA_DV, nv.NHANVIEN_ID, :status, :groupId
           FROM V_NHANVIEN nv
           JOIN V_DONVI dv ON dv.DONVI_ID = nv.DONVI_ID
          WHERE nv.NHANVIEN_ID = :employeeId`,
        {
          account: input.account,
          password: 'SSO_PENDING',
          employeeId: input.employeeId,
          status: input.status,
          groupId: input.groupIds[0] ?? null,
        },
      );
      return result.rowsAffected ?? 0;
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
            SET (MA_NV, TEN_NV, DONVI_ID, MA_DV, NHANVIEN_ID,
                 TRANGTHAI, LEVEL_ROLE) =
                (SELECT nv.MA_NV, nv.TEN_NV, nv.DONVI_ID, dv.MA_DV,
                        nv.NHANVIEN_ID, :status, :groupId
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
          groupId: input.groupIds[0] ?? null,
        },
      );
      return result.rowsAffected ?? 0;
    });
  }

  async deleteUser(account: string): Promise<number> {
    return this.oracleService.executeMutation(
      'DELETE FROM V_NGUOIDUNG_DIABAN WHERE MA_ND = :account',
      { account },
    );
  }

  async findGroups(): Promise<AdminGroup[]> {
    const [groups, assignments] = await Promise.all([
      this.oracleService.executeQuery<GroupRow>(
        `SELECT g.NHOMND_ID, g.TEN_NHOMND,
                (SELECT COUNT(*) FROM V_NGUOIDUNG_DIABAN u
                  WHERE u.LEVEL_ROLE = g.NHOMND_ID) AS USER_COUNT
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
        'UPDATE V_NGUOIDUNG_DIABAN SET LEVEL_ROLE = NULL WHERE LEVEL_ROLE = :id',
        { id },
      );
      await connection.execute(
        'DELETE FROM GLI_NHOM_ND_MENU WHERE NHOMND_ID = :id',
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

  async findReportGroups(): Promise<ReportGroup[]> {
    const rows = await this.oracleService.executeQuery<ReportGroupRow>(
      `SELECT g.NHOMBC_ID, g.NHOM_BC, g.GHICHU,
              (SELECT COUNT(*) FROM ONEBSS_BAOCAO_GLI b
                WHERE b.NHOMBC_ID = g.NHOMBC_ID) AS REPORT_COUNT
         FROM ONEBSS_NHOMBC_GLI g
        ORDER BY g.NHOM_BC, g.NHOMBC_ID`,
    );
    return rows.map((row) => ({
      id: this.text(row.NHOMBC_ID),
      name: this.text(row.NHOM_BC),
      note: this.nullableText(row.GHICHU),
      reportCount: Number(row.REPORT_COUNT ?? 0),
    }));
  }

  createReportGroup(input: { name: string; note?: string }): Promise<void> {
    return this.oracleService.withTransaction(async (connection) => {
      await connection.execute('LOCK TABLE ONEBSS_NHOMBC_GLI IN EXCLUSIVE MODE');
      const idResult = await connection.execute<{ NEXT_ID: number }>(
        'SELECT NVL(MAX(NHOMBC_ID), 0) + 1 AS NEXT_ID FROM ONEBSS_NHOMBC_GLI',
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      await connection.execute(
        `INSERT INTO ONEBSS_NHOMBC_GLI (NHOMBC_ID, NHOM_BC, GHICHU)
         VALUES (:id, :name, :note)`,
        {
          id: idResult.rows?.[0]?.NEXT_ID,
          name: input.name,
          note: input.note || null,
        },
      );
    });
  }

  updateReportGroup(
    id: string,
    input: { name: string; note?: string },
  ): Promise<number> {
    return this.oracleService.executeMutation(
      `UPDATE ONEBSS_NHOMBC_GLI
          SET NHOM_BC = :name, GHICHU = :note
        WHERE NHOMBC_ID = :id`,
      { id, name: input.name, note: input.note || null },
    );
  }

  countReportsInGroup(id: string): Promise<number> {
    return this.oracleService
      .executeQuery<{ TOTAL: number }>(
        'SELECT COUNT(*) AS TOTAL FROM ONEBSS_BAOCAO_GLI WHERE NHOMBC_ID = :id',
        { id },
      )
      .then((rows) => Number(rows[0]?.TOTAL ?? 0));
  }

  deleteReportGroup(id: string): Promise<number> {
    return this.oracleService.executeMutation(
      'DELETE FROM ONEBSS_NHOMBC_GLI WHERE NHOMBC_ID = :id',
      { id },
    );
  }

  async findReports(search = '', groupId = ''): Promise<ReportDefinition[]> {
    const normalizedSearch = search.trim().toUpperCase();
    const rows = await this.oracleService.executeQuery<ReportRow>(
      `SELECT b.BAOCAO_ID, b.TEN_BC, b.STRING_SQL,
              b.TM1, b.TM2, b.TM3, b.TM4, b.TM5, b.TM6, b.TM7,
              b.RPT_VIEW, b.RPT_EXPORT, b.NHOMBC_ID, g.NHOM_BC, b.PROC_PK
         FROM ONEBSS_BAOCAO_GLI b
         LEFT JOIN ONEBSS_NHOMBC_GLI g ON g.NHOMBC_ID = b.NHOMBC_ID
        WHERE (:searchText IS NULL
               OR UPPER(b.TEN_BC) LIKE :searchLike
               OR TO_CHAR(b.BAOCAO_ID) LIKE :searchLike)
          AND (:groupId IS NULL OR b.NHOMBC_ID = :groupId)
        ORDER BY g.NHOM_BC, b.TEN_BC, b.BAOCAO_ID`,
      {
        searchText: normalizedSearch || null,
        searchLike: normalizedSearch ? `%${normalizedSearch}%` : null,
        groupId: groupId || null,
      },
      { fetchInfo: { STRING_SQL: { type: oracledb.STRING } } },
    );
    return rows.map((row) => ({
      id: this.text(row.BAOCAO_ID),
      name: this.text(row.TEN_BC),
      sql: this.nullableText(row.STRING_SQL),
      parameters: [row.TM1, row.TM2, row.TM3, row.TM4, row.TM5, row.TM6, row.TM7]
        .map((value) => this.nullableText(value)),
      reportView: this.nullableText(row.RPT_VIEW),
      reportExport: this.nullableText(row.RPT_EXPORT),
      groupId: this.nullableText(row.NHOMBC_ID),
      groupName: this.nullableText(row.NHOM_BC),
      procedurePackage: this.nullableText(row.PROC_PK),
    }));
  }

  createReport(input: ReportMutationInput): Promise<void> {
    return this.oracleService.withTransaction(async (connection) => {
      await connection.execute('LOCK TABLE ONEBSS_BAOCAO_GLI IN EXCLUSIVE MODE');
      const idResult = await connection.execute<{ NEXT_ID: number }>(
        'SELECT NVL(MAX(BAOCAO_ID), 0) + 1 AS NEXT_ID FROM ONEBSS_BAOCAO_GLI',
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      await connection.execute(
        `INSERT INTO ONEBSS_BAOCAO_GLI
          (BAOCAO_ID, TEN_BC, STRING_SQL, TM1, TM2, TM3, TM4, TM5, TM6, TM7,
           RPT_VIEW, RPT_EXPORT, NHOMBC_ID, PROC_PK)
         VALUES
          (:id, :name, :sql, :tm1, :tm2, :tm3, :tm4, :tm5, :tm6, :tm7,
           :reportView, :reportExport, :groupId, :procedurePackage)`,
        { id: idResult.rows?.[0]?.NEXT_ID, ...this.reportBinds(input) },
      );
    });
  }

  async reportExists(id: string): Promise<boolean> {
    const rows = await this.oracleService.executeQuery<{ TOTAL: number }>(
      'SELECT COUNT(*) AS TOTAL FROM ONEBSS_BAOCAO_GLI WHERE BAOCAO_ID = :id',
      { id },
    );
    return Number(rows[0]?.TOTAL ?? 0) > 0;
  }

  updateReport(id: string, input: ReportMutationInput): Promise<number> {
    return this.oracleService.executeMutation(
      `UPDATE ONEBSS_BAOCAO_GLI
          SET TEN_BC = :name, STRING_SQL = :sql,
              TM1 = :tm1, TM2 = :tm2, TM3 = :tm3, TM4 = :tm4,
              TM5 = :tm5, TM6 = :tm6, TM7 = :tm7,
              RPT_VIEW = :reportView, RPT_EXPORT = :reportExport,
              NHOMBC_ID = :groupId, PROC_PK = :procedurePackage
        WHERE BAOCAO_ID = :id`,
      { id, ...this.reportBinds(input) },
    );
  }

  deleteReport(id: string): Promise<number> {
    return this.oracleService.executeMutation(
      'DELETE FROM ONEBSS_BAOCAO_GLI WHERE BAOCAO_ID = :id',
      { id },
    );
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

  private text(value: unknown): string {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  private nullableText(value: unknown): string | null {
    return this.text(value) || null;
  }

  private reportBinds(input: ReportMutationInput) {
    return {
      name: input.name,
      sql: input.sql || null,
      tm1: input.tm1 || null,
      tm2: input.tm2 || null,
      tm3: input.tm3 || null,
      tm4: input.tm4 || null,
      tm5: input.tm5 || null,
      tm6: input.tm6 || null,
      tm7: input.tm7 || null,
      reportView: input.reportView || null,
      reportExport: input.reportExport || null,
      groupId: input.groupId || null,
      procedurePackage: input.procedurePackage || null,
    };
  }
}

interface ReportMutationInput {
  name: string;
  sql?: string;
  tm1?: string;
  tm2?: string;
  tm3?: string;
  tm4?: string;
  tm5?: string;
  tm6?: string;
  tm7?: string;
  reportView?: string;
  reportExport?: string;
  groupId?: string;
  procedurePackage?: string;
}
