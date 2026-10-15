import { BadRequestException, Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../../database/oracle.service.js';
import { KpiQueryDto } from './kpi-query.dto.js';
import { KpiPscQueryDto } from './kpi-psc-query.dto.js';
import { KpiTrendQueryDto } from './kpi-trend-query.dto.js';

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

export interface KpiTrendRow {
  month: string;
  subscribers: number | null;
  revenue: number | null;
}

export interface KpiPscRow {
  unitCode: string;
  unitName: string;
  monthlyNew: number | null;
  monthlyPsc: number | null;
  cumulativeNew: number | null;
  cumulativePsc: number | null;
  cumulativeNetGrowth: number | null;
  cumulativeStopped: number | null;
  cumulativeStopRate: number | null;
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

  async trend(input: KpiTrendQueryDto): Promise<{ month: string; rows: KpiTrendRow[] }> {
    const [year, month] = input.month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const result = await this.oracleService.executeProcedure(
      PACKAGE_NAME,
      input.procedure,
      {
        P_TUNGAY: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `01/01/${year}` },
        P_DENNGAY: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` },
        P_RESULT: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      },
    );
    const rawRows = result.outBinds?.P_RESULT;
    const row = Array.isArray(rawRows) ? rawRows[0] as Record<string, unknown> | undefined : undefined;
    const number = (value: unknown): number | null => {
      if (value == null) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      month: input.month,
      rows: Array.from({ length: month }, (_, index) => {
        const monthText = `${year}${String(index + 1).padStart(2, '0')}`;
        return {
          month: `${year}-${String(index + 1).padStart(2, '0')}`,
          subscribers: number(row?.[`SL_TB_${monthText}01`]),
          revenue: number(row?.[`DOANH_THU_${monthText}01`]),
        };
      }),
    };
  }

  async psc(input: KpiPscQueryDto): Promise<{ month: string; rows: KpiPscRow[] }> {
    const [year, month] = input.month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthText = String(month).padStart(2, '0');
    const result = await this.oracleService.executeProcedure(PACKAGE_NAME, input.procedure, {
      P_TUNGAY: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `01/${monthText}/${year}` },
      P_DENNGAY: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `${String(lastDay).padStart(2, '0')}/${monthText}/${year}` },
      P_RESULT: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
    });
    const rawRows = result.outBinds?.P_RESULT;
    const number = (value: unknown): number | null => {
      if (value == null) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      month: input.month,
      rows: Array.isArray(rawRows) ? rawRows.map((value) => {
        const row = value as Record<string, unknown>;
        return {
          unitCode: String(row.MA_DV ?? '').trim(),
          unitName: String(row.TEN_DV ?? '').trim(),
          monthlyNew: number(row.PTM_THANG_BC),
          monthlyPsc: number(row.PSC_THANG_BC),
          cumulativeNew: number(row.PTM_LUY_KE),
          cumulativePsc: number(row.PSC_LUY_KE),
          cumulativeNetGrowth: number(row.TB_THUC_TANG_LK),
          cumulativeStopped: number(row.NGUNG_PSC_LUY_KE),
          cumulativeStopRate: number(row.TYLE_NGUNG_PSC_LK),
        };
      }) : [],
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
