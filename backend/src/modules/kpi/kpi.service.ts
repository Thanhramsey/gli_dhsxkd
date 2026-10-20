import { BadRequestException, Injectable } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../../database/oracle.service.js';
import { KpiQueryDto } from './kpi-query.dto.js';
import { KpiPscQueryDto } from './kpi-psc-query.dto.js';
import { KpiTrendQueryDto } from './kpi-trend-query.dto.js';

const PACKAGE_NAME = 'NBH_CDS_NEW.MA_KPI_GLI_TONG';
const PROCEDURE_NAME = 'TONG_HOP_KPI';
const SNAPSHOT_KPI_CODES: Readonly<Record<string, string | undefined>> = {
  TONG_HOP_KPI_BRCD: 'F1.FIBER_C2',
  TONG_HOP_KPI_MYTV: 'F1.MYTV_C2',
  TONG_HOP_KPI_CAM: 'F1.CAM_C2',
  TONG_HOP_KPI_MESH: 'F1.MESH_C2',
  TONG_HOP_KPI_TSL: 'F1.DITT_C2',
  TONG_HOP_KPI_CNTT: 'F4.1_C2',
};

function normalizeKpiMonth(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }
  const text = String(value ?? '').trim();
  const dayMonthYear = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dayMonthYear) {
    const month = Number(dayMonthYear[2]);
    return month >= 1 && month <= 12 ? `${dayMonthYear[3]}-${String(month).padStart(2, '0')}` : '';
  }
  const monthYear = text.match(/^(\d{1,2})[./-](\d{4})$/);
  if (monthYear) {
    const month = Number(monthYear[1]);
    return month >= 1 && month <= 12 ? `${monthYear[2]}-${String(month).padStart(2, '0')}` : '';
  }
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 6) {
    const year = digits.slice(0, 4);
    const month = Number(digits.slice(4, 6));
    if (Number(year) >= 1900 && month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, '0')}`;
  }
  return '';
}

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
  plan?: number | null;
  completionRate?: number | null;
  cumulativeRevenue?: number | null;
  cumulativePlan?: number | null;
  cumulativeRate?: number | null;
  annualPlan?: number | null;
  annualRate?: number | null;
  snapshotMonth?: string | null;
  billingCycle?: string | null;
  chartName?: string | null;
  kpi?: string | null;
  updatedAt?: string | null;
}

export interface KpiMaintenanceRow {
  unitCode: string;
  unitName: string;
  baseRevenueFiber: number | null;
  baseRevenueMyTv: number | null;
  baseRevenue: number | null;
  cumulativeBaseRevenueFiber: number | null;
  cumulativeBaseRevenueMyTv: number | null;
  cumulativeBaseRevenue: number | null;
  fiberSubscribers: number | null;
  mytvSubscribers: number | null;
  subscribers: number | null;
  arpuFiber: number | null;
  arpuMyTv: number | null;
  stoppedFiberSubscribers: number | null;
  stoppedMyTvSubscribers: number | null;
  stoppedSubscribers: number | null;
  stoppedFiberRevenue: number | null;
  stoppedMyTvRevenue: number | null;
  stoppedRevenue: number | null;
  estimatedCanceledFiberRevenue: number | null;
  estimatedCanceledMyTvRevenue: number | null;
  estimatedCanceledRevenue: number | null;
  maintainedRevenue: number | null;
  maintainedRate: number | null;
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

  async latestMonth(procedure?: string): Promise<{ month: string | null }> {
    const snapshotKpi = procedure ? SNAPSHOT_KPI_CODES[procedure] : undefined;
    const [row] = snapshotKpi
      ? await this.oracleService.executeQuery<{ LATEST_MONTH: unknown }>(
        `SELECT MAX(TRIM(TO_CHAR(THANG_DULIEU))) AS LATEST_MONTH
           FROM NBH_CDS_NEW.TONGHOP_KPI
          WHERE KPI = :KPI`,
        { KPI: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: snapshotKpi } },
      )
      : await this.oracleService.executeQuery<{ LATEST_MONTH: unknown }>(
        `SELECT MAX(LATEST_MONTH) AS LATEST_MONTH
           FROM (
             SELECT TO_CHAR(MAX(THANG)) AS LATEST_MONTH
               FROM NBH_CDS_NEW.GLI_KQ_KPI_TONG
             UNION ALL
             SELECT MAX(TRIM(TO_CHAR(THANG_DULIEU))) AS LATEST_MONTH
               FROM NBH_CDS_NEW.TONGHOP_KPI
              WHERE KPI IN ('F1.MYTV_C2', 'F1.FIBER_C2', 'F1.DITT_C2', 'F4.1_C2', 'F1.CAM_C2', 'F1.MESH_C2')
           )`,
      );
    const value = String(row?.LATEST_MONTH ?? '').trim();
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
    const snapshotKpi = SNAPSHOT_KPI_CODES[input.procedure];
    const number = (value: unknown): number | null => {
      if (value == null) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    if (snapshotKpi) {
      const snapshotMonth = `${year}${String(month).padStart(2, '0')}`;
      const rows = await this.oracleService.executeQuery<Record<string, unknown>>(
        `SELECT BIEUDO, KPI, KY_CUOC, THANG, THANG_DULIEU, DOANH_THU,
                KE_HOACH_THANG, TY_LE_THANG, DOANH_THU_LK, KE_HOACH_LK_THANG,
                TY_LE_LK_THANG, KE_HOACH_LK_NAM, TY_LE_LK_NAM,
                TO_CHAR(NGAY_CAP_NHAT, 'DD/MM/YYYY HH24:MI:SS') AS NGAY_CAP_NHAT
           FROM NBH_CDS_NEW.TONGHOP_KPI
          WHERE KPI = :KPI AND TRIM(TO_CHAR(THANG_DULIEU)) = :THANG_DULIEU
          ORDER BY KY_CUOC`,
        {
          KPI: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: snapshotKpi },
          THANG_DULIEU: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: snapshotMonth },
        },
      );
      return {
        month: input.month,
        rows: rows.map((row) => {
          const yearMonth = normalizeKpiMonth(row.THANG) || normalizeKpiMonth(row.KY_CUOC);
          const snapshot = String(row.THANG_DULIEU ?? '').trim();
          return {
            month: yearMonth,
            subscribers: null,
            revenue: number(row.DOANH_THU),
            plan: number(row.KE_HOACH_THANG),
            completionRate: number(row.TY_LE_THANG),
            cumulativeRevenue: number(row.DOANH_THU_LK),
            cumulativePlan: number(row.KE_HOACH_LK_THANG),
            cumulativeRate: number(row.TY_LE_LK_THANG),
            annualPlan: number(row.KE_HOACH_LK_NAM),
            annualRate: number(row.TY_LE_LK_NAM),
            snapshotMonth: /^\d{6}$/.test(snapshot) ? `${snapshot.slice(0, 4)}-${snapshot.slice(4)}` : snapshot || null,
            billingCycle: row.KY_CUOC == null ? null : String(row.KY_CUOC).trim(),
            chartName: row.BIEUDO == null ? null : String(row.BIEUDO).trim(),
            kpi: row.KPI == null ? null : String(row.KPI).trim(),
            updatedAt: row.NGAY_CAP_NHAT == null ? null : String(row.NGAY_CAP_NHAT).trim(),
          };
        }).filter((row) => /^\d{4}-(0[1-9]|1[0-2])$/.test(row.month)),
      };
    }
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

  async maintenance(monthValue: string): Promise<{ month: string; rows: KpiMaintenanceRow[] }> {
    const [year, month] = monthValue.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthText = String(month).padStart(2, '0');
    const result = await this.oracleService.executeProcedure(
      PACKAGE_NAME,
      'BC_DT_DUY_TRI_FIBER_MYTV',
      {
        P_TUNGAY: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `01/${monthText}/${year}` },
        P_DENNGAY: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `${String(lastDay).padStart(2, '0')}/${monthText}/${year}` },
        P_RESULT: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      },
    );
    const rawRows = result.outBinds?.P_RESULT;
    const number = (value: unknown): number | null => {
      if (value == null) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      month: monthValue,
      rows: Array.isArray(rawRows) ? rawRows.map((value) => {
        const row = value as Record<string, unknown>;
        return {
          unitCode: String(row.MA_DV ?? '').trim(),
          unitName: String(row.TEN_DV ?? '').trim(),
          baseRevenueFiber: number(row.DT_GOC_FIBER),
          baseRevenueMyTv: number(row.DT_GOC_MYTV),
          baseRevenue: number(row.DT_GOC),
          cumulativeBaseRevenueFiber: number(row.DT_GOC_LK_FIBER),
          cumulativeBaseRevenueMyTv: number(row.DT_GOC_LK_MYTV),
          cumulativeBaseRevenue: number(row.DT_GOC_LUY_KE),
          fiberSubscribers: number(row.SL_TB_FIBER),
          mytvSubscribers: number(row.SL_TB_MYTV),
          subscribers: number(row.SL_TB_GOC),
          arpuFiber: number(row.ARPU_FIBER),
          arpuMyTv: number(row.ARPU_MYTV),
          stoppedFiberSubscribers: number(row.SL_NGUNG_FIBER_LK),
          stoppedMyTvSubscribers: number(row.SL_NGUNG_MYTV_LK),
          stoppedSubscribers: number(row.SL_NGUNG_PSC_LK),
          stoppedFiberRevenue: number(row.DT_NGUNG_FIBER_LK),
          stoppedMyTvRevenue: number(row.DT_NGUNG_MYTV_LK),
          stoppedRevenue: number(row.DT_NGUNG_PSC_LK),
          estimatedCanceledFiberRevenue: number(row.DT_HUY_FIBER),
          estimatedCanceledMyTvRevenue: number(row.DT_HUY_MYTV),
          estimatedCanceledRevenue: number(row.DT_HUY_LUY_KE),
          maintainedRevenue: number(row.DT_DUY_TRI),
          maintainedRate: number(row.TYLE_DT_DUY_TRI),
        };
      }) : [],
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
