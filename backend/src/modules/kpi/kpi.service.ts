import { BadRequestException, Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../../database/oracle.service.js';
import { KpiQueryDto } from './kpi-query.dto.js';

const PACKAGE_NAME = 'NBH_CDS_NEW.MA_KPI_GLI_TONG';
const PROCEDURE_NAME = 'TONG_HOP_KPI';

export interface KpiRow {
  name: string;
  monthlyPlan: number;
  cumulativePlan: number;
  monthlyActual: number;
  cumulativeActual: number;
  monthlyRate: number | null;
  cumulativeRate: number | null;
}

@Injectable()
export class KpiService {
  constructor(private readonly oracleService: OracleService) {}

  async latestMonth(): Promise<{ month: string | null }> {
    const [row] = await this.oracleService.executeQuery<{ LATEST_MONTH: unknown }>(
      'SELECT MAX(THANG) AS LATEST_MONTH FROM NBH_CDS_NEW.GLI_KQ_KPI_TONG',
    );
    const value = String(row?.LATEST_MONTH ?? '');
    return { month: /^\d{6}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4)}` : null };
  }

  async summary(input: KpiQueryDto): Promise<{ month: string; rows: KpiRow[] }> {
    const [year, month] = input.month.split('-').map(Number);
    if (!year || !month) throw new BadRequestException('Tháng báo cáo không hợp lệ');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthText = String(month).padStart(2, '0');
    const result = await this.oracleService.executeProcedure(
      PACKAGE_NAME,
      PROCEDURE_NAME,
      {
        P_TUNGAY: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `01/${monthText}/${year}` },
        P_DENNGAY: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `${String(lastDay).padStart(2, '0')}/${monthText}/${year}` },
        P_RESULT: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      },
    );
    const rawRows = result.outBinds?.P_RESULT;
    return {
      month: input.month,
      rows: Array.isArray(rawRows)
        ? rawRows.map((row) => this.normalizeRow(row as Record<string, unknown>))
        : [],
    };
  }

  private normalizeRow(row: Record<string, unknown>): KpiRow {
    const values = Object.values(row);
    const number = (value: unknown): number => {
      const parsed = Number(value);
      return value == null || !Number.isFinite(parsed) ? 0 : parsed;
    };
    return {
      name: String(values[0] ?? '').trim(),
      monthlyPlan: number(values[1]),
      cumulativePlan: number(values[2]),
      monthlyActual: number(values[3]),
      cumulativeActual: number(values[4]),
      monthlyRate: values[5] == null ? null : number(values[5]),
      cumulativeRate: values[6] == null ? null : number(values[6]),
    };
  }
}
