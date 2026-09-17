import { Injectable } from '@nestjs/common';
import { OracleService } from '../../database/oracle.service.js';

export interface MenuRow {
  MENU_ID: unknown;
  MENU_NAME: unknown;
  MENU_URL: unknown;
  MENU_CHA_ID: unknown;
  ORDER_INDEX: unknown;
  MENU_ICON: unknown;
  IS_HEADING: unknown;
}

export interface GroupRow {
  NHOMND_ID: unknown;
  TEN_NHOMND: unknown;
}

const MENU_COLUMNS = `
  m.MENU_ID, m.MENU_NAME, m.MENU_URL, m.MENU_CHA_ID,
  m.ORDER_INDEX, m.MENU_ICON, m.IS_HEADING`;

@Injectable()
export class MenuRepository {
  constructor(private readonly oracleService: OracleService) {}

  findByGroupIds(groupIds: string[]): Promise<MenuRow[]> {
    if (!groupIds.length) return Promise.resolve([]);
    const binds = Object.fromEntries(
      groupIds.map((groupId, index) => [`groupId${index}`, groupId]),
    );
    const placeholders = groupIds
      .map((_, index) => `:groupId${index}`)
      .join(', ');
    return this.oracleService.executeQuery<MenuRow>(
      `SELECT DISTINCT ${MENU_COLUMNS}
         FROM GLI_MENU m
         JOIN GLI_NHOM_ND_MENU gm ON gm.MENU_ID = m.MENU_ID
        WHERE gm.NHOMND_ID IN (${placeholders})
        ORDER BY m.ORDER_INDEX NULLS LAST, m.MENU_ID`,
      binds,
    );
  }

  findAll(): Promise<MenuRow[]> {
    return this.oracleService.executeQuery<MenuRow>(
      `SELECT ${MENU_COLUMNS}
         FROM GLI_MENU m
        ORDER BY m.ORDER_INDEX NULLS LAST, m.MENU_ID`,
    );
  }

  findGroups(): Promise<GroupRow[]> {
    return this.oracleService.executeQuery<GroupRow>(
      `SELECT NHOMND_ID, TEN_NHOMND
         FROM GLI_NHOM_ND
        ORDER BY TEN_NHOMND, NHOMND_ID`,
    );
  }
}
