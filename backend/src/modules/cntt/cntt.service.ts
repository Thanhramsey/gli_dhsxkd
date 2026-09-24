import { BadRequestException, Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../../database/oracle.service.js';
import { CnttQueryDto } from './dto/cntt-query.dto.js';

const PACKAGE_NAME = 'NBH_CDS_NEW.PACK_CNTT';
const PROCEDURE_NAME = 'TONGHOP_DOANHTHU_CNTT';

export interface CnttRevenueRow {
  unitId: number | null;
  unitName: string;
  plan: number;
  serviceGroupA: number;
  serviceGroupBC: number;
  serviceRevenue: number;
  equipmentGroupA: number;
  equipmentGroupBC: number;
  equipmentRevenue: number;
  actual: number;
  completionRate: number | null;
  isTotal: boolean;
}

@Injectable()
export class CnttService {
  constructor(private readonly oracleService: OracleService) {}

  async revenue(input: CnttQueryDto): Promise<{ month: string; rows: CnttRevenueRow[] }> {
    if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(input.month)) {
      throw new BadRequestException('Tháng phải có định dạng YYYY-MM');
    }

    const [year, month] = input.month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthText = String(month).padStart(2, '0');
    const binds: oracledb.BindParameters = {
      P_FROM: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `01/${monthText}/${year}` },
      P_TO: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `${lastDay}/${monthText}/${year}` },
      // Ba tham số này hiện chưa được dùng trong package; giữ 0 để lấy toàn bộ dữ liệu.
      P_DONVI: { dir: oracledb.BIND_IN, type: oracledb.NUMBER, val: 0 },
      P_DICHVU: { dir: oracledb.BIND_IN, type: oracledb.NUMBER, val: 0 },
      P_LOAITB: { dir: oracledb.BIND_IN, type: oracledb.NUMBER, val: 0 },
      P_CURSOR: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
    };

    const result = await this.oracleService.executeProcedure(PACKAGE_NAME, PROCEDURE_NAME, binds);
    const rawRows = result.outBinds?.P_CURSOR;
    return {
      month: input.month,
      rows: Array.isArray(rawRows)
        ? rawRows.map((row) => this.normalizeRow(row as Record<string, unknown>))
        : [],
    };
  }

  private normalizeRow(row: Record<string, unknown>): CnttRevenueRow {
    // Oracle trả các cột theo đúng thứ tự SELECT; dùng vị trí cho các alias tiếng Việt
    // để API không phụ thuộc cách mã hóa tên cột trên từng DB/client.
    const values = Object.values(row);
    const number = (value: unknown): number => {
      const parsed = Number(value);
      return value == null || !Number.isFinite(parsed) ? 0 : parsed;
    };
    const rate = values[10] == null ? null : number(values[10]);

    return {
      unitId: values[0] == null ? null : number(values[0]),
      unitName: String(values[1] ?? '').trim(),
      plan: number(values[2]),
      serviceGroupA: number(values[3]),
      serviceGroupBC: number(values[4]),
      serviceRevenue: number(values[5]),
      equipmentGroupA: number(values[6]),
      equipmentGroupBC: number(values[7]),
      equipmentRevenue: number(values[8]),
      actual: number(values[9]),
      completionRate: rate,
      isTotal: number(values[11]) === 1,
    };
  }
}
