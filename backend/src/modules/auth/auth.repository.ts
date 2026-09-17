import { Injectable } from '@nestjs/common';
import { OracleService } from '../../database/oracle.service.js';

interface AreaUserRow {
  MA_ND: unknown;
  NHANVIEN_ID: unknown;
  TRANGTHAI: unknown;
  MA_NV: unknown;
  TEN_NV: unknown;
  LEVEL_ROLE: unknown;
  CHUCDANH: unknown;
  SO_DT: unknown;
  EMAIL: unknown;
  DONVI_ID: unknown;
  MA_DV: unknown;
  TEN_DV: unknown;
}

interface UserGroupRow {
  NHOMND_ID: unknown;
  TEN_NHOMND: unknown;
}

export interface UserRecord {
  userId: string;
  account: string;
  displayName: string;
  groupIds: string[];
  groupId: string | null;
  groupName: string | null;
  status: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  fullName: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  unitId: string | null;
  unitCode: string | null;
  unitName: string | null;
  source: 'V_NGUOIDUNG_DIABAN';
}

const FIND_USER = `
  SELECT * FROM (
    SELECT u.MA_ND, u.NHANVIEN_ID, u.TRANGTHAI,
           NVL(nv.MA_NV, u.MA_NV) AS MA_NV,
           NVL(nv.TEN_NV, u.TEN_NV) AS TEN_NV,
           u.LEVEL_ROLE, nv.CHUCDANH, nv.SO_DT, nv.EMAIL,
           NVL(nv.DONVI_ID, u.DONVI_ID) AS DONVI_ID,
           NVL(dv.MA_DV, u.MA_DV) AS MA_DV, dv.TEN_DV
      FROM V_NGUOIDUNG_DIABAN u
      LEFT JOIN V_NHANVIEN nv ON nv.NHANVIEN_ID = u.NHANVIEN_ID
      LEFT JOIN V_DONVI dv ON dv.DONVI_ID = NVL(nv.DONVI_ID, u.DONVI_ID)
     WHERE UPPER(TRIM(u.MA_ND)) = UPPER(TRIM(:account))
     ORDER BY u.MA_ND
  ) WHERE ROWNUM = 1`;

const FIND_USER_GROUPS = `
  SELECT DISTINCT ung.NHOMND_ID, g.TEN_NHOMND
    FROM V_NGUOIDUNG_NHOMND ung
    LEFT JOIN GLI_NHOM_ND g ON g.NHOMND_ID = ung.NHOMND_ID
   WHERE UPPER(TRIM(ung.MA_ND)) = UPPER(TRIM(:account))
   ORDER BY g.TEN_NHOMND, ung.NHOMND_ID`;

@Injectable()
export class AuthRepository {
  constructor(private readonly oracleService: OracleService) {}

  async findByAccount(account: string): Promise<UserRecord | null> {
    const rows = await this.oracleService.executeQuery<AreaUserRow>(FIND_USER, {
      account,
    });
    if (!rows[0]) return null;
    return this.attachGroups(
      this.mapUser(rows[0]),
      await this.findGroupsByAccount(account),
    );
  }

  private findGroupsByAccount(account: string): Promise<UserGroupRow[]> {
    return this.oracleService.executeQuery<UserGroupRow>(FIND_USER_GROUPS, {
      account,
    });
  }

  private attachGroups(record: UserRecord, rows: UserGroupRow[]): UserRecord {
    const groupIds = [
      ...new Set(rows.map((row) => this.text(row.NHOMND_ID)).filter(Boolean)),
    ] as string[];
    const groupNames = [
      ...new Set(
        rows.map(
          (row) =>
            this.text(row.TEN_NHOMND) ?? this.text(row.NHOMND_ID) ?? '',
        ),
      ),
    ].filter(Boolean);
    return {
      ...record,
      groupIds,
      groupId: groupIds[0] ?? null,
      groupName: groupNames.length ? groupNames.join(', ') : null,
    };
  }

  private mapUser(row: AreaUserRow): UserRecord {
    const account = this.text(row.MA_ND) ?? '';
    const fullName = this.text(row.TEN_NV) ?? account;
    return {
      userId: `area:${account}`,
      account,
      displayName: fullName,
      groupIds: [],
      groupId: null,
      groupName: null,
      status: this.text(row.TRANGTHAI),
      employeeId: this.text(row.NHANVIEN_ID),
      employeeCode: this.text(row.MA_NV),
      fullName,
      title: this.text(row.CHUCDANH) ?? this.text(row.LEVEL_ROLE),
      phone: this.text(row.SO_DT),
      email: this.text(row.EMAIL),
      unitId: this.text(row.DONVI_ID),
      unitCode: this.text(row.MA_DV),
      unitName: this.text(row.TEN_DV),
      source: 'V_NGUOIDUNG_DIABAN',
    };
  }

  private text(value: unknown): string | null {
    if (value === null || value === undefined || value === '') return null;
    return String(value).trim();
  }
}
