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
  TONG_HOP_KPI_DITT: 'F1.DITT_C2',
  TONG_HOP_KPI_TSL: 'F4.3_C2',
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

export interface KpiFiberPscRow {
  service: string;
  unitGroup: string;
  unitCode: string;
  unitName: string;
  monthlyPscSubscribers: number | null;
  monthlyNetPscSubscribers: number | null;
  monthlyRevenue: number | null;
  cumulativeRevenue: number | null;
  monthlyRevenuePlan: number | null;
  cumulativeRevenuePlan: number | null;
  annualRevenuePlan: number | null;
}

export interface KpiV2Row {
  kpi: string;
  unitCode: string;
  unitName: string;
  chartName: string;
  monthlyRevenue: number | null;
  monthlyPlan: number | null;
  cumulativeRevenue: number | null;
  cumulativePlan: number | null;
  annualPlan: number | null;
  rank: number | null;
  cumulativeRank: number | null;
  annualRank: number | null;
  monthlyChange: number | null;
  remainingAnnual: number | null;
}

export interface KpiV2TrendRow {
  month: string;
  monthlyRevenue: number | null;
  monthlyPlan: number | null;
  cumulativeRevenue: number | null;
  cumulativePlan: number | null;
  annualPlan: number | null;
  monthlyChange: number | null;
  remainingAnnual: number | null;
}

export interface KpiV2SubscriberRow {
  kpi: string;
  unitCode: string;
  unitName: string;
  service: string;
  indicator: string;
  previousYear: number | null;
  currentYear: number | null;
  previousCount: number | null;
  currentCount: number | null;
  change: number | null;
}

@Injectable()
export class KpiService {
  constructor(private readonly oracleService: OracleService) {}

  async v2Months(): Promise<{ months: string[] }> {
    const rows = await this.oracleService.executeQuery<{ REPORT_MONTH: unknown }>(
      `SELECT DISTINCT TRIM(THANG_DULIEU) AS REPORT_MONTH
         FROM NBH_CDS_NEW.TONGHOP_KPI_ALL
        WHERE REGEXP_LIKE(TRIM(KPI), '_C3$')
          AND REGEXP_LIKE(TRIM(THANG_DULIEU), '^20[0-9]{4}$')
          AND TRIM(THANG) = TRIM(THANG_DULIEU)
        ORDER BY REPORT_MONTH DESC`,
    );
    return { months: rows.map(row => String(row.REPORT_MONTH).trim()) };
  }

  async v2Report(month: string): Promise<{ month: string; rows: KpiV2Row[] }> {
    const snapshot = month.replace('-', '');
    const rows = await this.oracleService.executeQuery<Record<string, unknown>>(
      `SELECT KPI, MA_DV, TEN_DV, BIEUDO, DOANH_THU, KE_HOACH_THANG,
              DOANH_THU_LK, KE_HOACH_LK_THANG, KE_HOACH_LK_NAM, XEP_HANG,
              XEP_HANG_LK_THANG, XEP_HANG_LK_NAM, TANG_GIAM, CON_LAI_NAM
         FROM (
           SELECT t.*, ROW_NUMBER() OVER (
             PARTITION BY KPI, MA_DV ORDER BY KY_CUOC DESC
           ) AS RN
             FROM NBH_CDS_NEW.TONGHOP_KPI_ALL t
            WHERE REGEXP_LIKE(TRIM(KPI), '_C3$')
              AND TRIM(THANG_DULIEU) = :reportMonth
              AND TRIM(THANG) = :reportMonth
         )
        WHERE RN = 1
        ORDER BY KPI, MA_DV`,
      { reportMonth: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: snapshot } },
    );
    const number = (value: unknown): number | null => {
      if (value == null || String(value).trim() === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      month,
      rows: rows.map(row => ({
        kpi: String(row.KPI).trim(),
        unitCode: String(row.MA_DV ?? '').trim(),
        unitName: String(row.TEN_DV ?? '').trim(),
        chartName: String(row.BIEUDO ?? '').trim(),
        monthlyRevenue: number(row.DOANH_THU),
        monthlyPlan: number(row.KE_HOACH_THANG),
        cumulativeRevenue: number(row.DOANH_THU_LK),
        cumulativePlan: number(row.KE_HOACH_LK_THANG),
        annualPlan: number(row.KE_HOACH_LK_NAM),
        rank: number(row.XEP_HANG),
        cumulativeRank: number(row.XEP_HANG_LK_THANG),
        annualRank: number(row.XEP_HANG_LK_NAM),
        monthlyChange: number(row.TANG_GIAM),
        remainingAnnual: number(row.CON_LAI_NAM),
      })),
    };
  }

  async v2SubscriberReport(month: string): Promise<{ month: string; rows: KpiV2SubscriberRow[] }> {
    const snapshot = month.replace('-', '');
    const rows = await this.oracleService.executeQuery<Record<string, unknown>>(
      `SELECT KPI, MA_DV, TEN_DV, DICH_VU, CHI_TIEU, NAM_TRUOC, NAM_NAY,
              SL_NAM_TRUOC, SL_NAM_NAY, TANG_GIAM
         FROM (
           SELECT t.*, ROW_NUMBER() OVER (
             PARTITION BY KPI, MA_DV ORDER BY KY_CUOC DESC, NGAY_CAP_NHAT DESC
           ) AS RN
             FROM NBH_CDS_NEW.TONGHOP_KPI_SOLUONG_C3 t
            WHERE TRIM(THANG_DULIEU) = :reportMonth
              AND TRIM(THANG) = :reportMonth
         )
        WHERE RN = 1
        ORDER BY DICH_VU, CHI_TIEU, MA_DV`,
      { reportMonth: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: snapshot } },
    );
    const number = (value: unknown): number | null => {
      if (value == null || String(value).trim() === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      month,
      rows: rows.map(row => ({
        kpi: String(row.KPI ?? '').trim(),
        unitCode: String(row.MA_DV ?? '').trim(),
        unitName: String(row.TEN_DV ?? '').trim(),
        service: String(row.DICH_VU ?? '').trim(),
        indicator: String(row.CHI_TIEU ?? '').trim(),
        previousYear: number(row.NAM_TRUOC),
        currentYear: number(row.NAM_NAY),
        previousCount: number(row.SL_NAM_TRUOC),
        currentCount: number(row.SL_NAM_NAY),
        change: number(row.TANG_GIAM),
      })),
    };
  }

  async v2UnitTrend(input: { month: string; kpi: string; unitCode: string }): Promise<{ month: string; kpi: string; unitCode: string; rows: KpiV2TrendRow[] }> {
    const reportMonth = input.month.replace('-', '');
    const firstMonth = `${reportMonth.slice(0, 4)}01`;
    const result = await this.oracleService.executeQuery<Record<string, unknown>>(
      `SELECT REPORT_MONTH, DOANH_THU, KE_HOACH_THANG, DOANH_THU_LK,
              KE_HOACH_LK_THANG, KE_HOACH_LK_NAM, TANG_GIAM, CON_LAI_NAM
         FROM (
           SELECT TRIM(THANG) AS REPORT_MONTH, DOANH_THU, KE_HOACH_THANG,
                  DOANH_THU_LK, KE_HOACH_LK_THANG, KE_HOACH_LK_NAM,
                  TANG_GIAM, CON_LAI_NAM,
                  ROW_NUMBER() OVER (
                    PARTITION BY TRIM(THANG)
                    ORDER BY TRIM(THANG_DULIEU) DESC, KY_CUOC DESC
                  ) AS RN
             FROM NBH_CDS_NEW.TONGHOP_KPI_ALL
            WHERE TRIM(KPI) = :kpi
              AND TRIM(MA_DV) = :unitCode
              AND TRIM(THANG) BETWEEN :firstMonth AND :reportMonth
              AND TRIM(THANG_DULIEU) BETWEEN TRIM(THANG) AND :reportMonth
         )
        WHERE RN = 1
        ORDER BY REPORT_MONTH`,
      {
        kpi: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: input.kpi },
        unitCode: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: input.unitCode },
        firstMonth: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: firstMonth },
        reportMonth: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: reportMonth },
      },
    );
    const number = (value: unknown): number | null => {
      if (value == null || String(value).trim() === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const byMonth = new Map(result.map(row => [String(row.REPORT_MONTH).trim(), row]));
    return {
      month: input.month,
      kpi: input.kpi,
      unitCode: input.unitCode,
      rows: Array.from({ length: Number(reportMonth.slice(4)) }, (_, index) => {
        const month = `${reportMonth.slice(0, 4)}-${String(index + 1).padStart(2, '0')}`;
        const row = byMonth.get(month.replace('-', ''));
        return {
          month,
          monthlyRevenue: number(row?.DOANH_THU),
          monthlyPlan: number(row?.KE_HOACH_THANG),
          cumulativeRevenue: number(row?.DOANH_THU_LK),
          cumulativePlan: number(row?.KE_HOACH_LK_THANG),
          annualPlan: number(row?.KE_HOACH_LK_NAM),
          monthlyChange: number(row?.TANG_GIAM),
          remainingAnnual: number(row?.CON_LAI_NAM),
        };
      }),
    };
  }

  async fiberPsc(month: string): Promise<{ month: string; rows: KpiFiberPscRow[] }> {
    const result = await this.oracleService.executeProcedure(
      'NBH_CDS_NEW.BCGIAOBAN_GLI',
      'SP_VIEW_PSC',
      {
        P_MONTH: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: month.replace('-', '') },
        RSOUT: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      },
    );
    const rawRows = result.outBinds?.RSOUT;
    // SP_VIEW_PSC labels TTVT rows DB_CHUNG; resolve their display group from the unit source.
    const unitGroups = new Map<string, string>();
    if (Array.isArray(rawRows) && rawRows.length) {
      const groupRows = await this.oracleService.executeQuery<{ MA_DV: unknown; NHOM_DVI: unknown }>(
        `SELECT DISTINCT TO_CHAR(DIABAN_ID) AS MA_DV, NHOM_DVI
           FROM v_donvi_diaban WHERE NHOM_DVI = 'TTVT'
         UNION
         SELECT DISTINCT MA_DV, NHOM_DVI
           FROM v_donvi_diaban WHERE NHOM_DVI = 'TOANTINH'`,
      );
      for (const row of groupRows) {
        unitGroups.set(String(row.MA_DV ?? '').trim(), String(row.NHOM_DVI ?? '').trim().toUpperCase());
      }
    }
    const number = (value: unknown): number | null => {
      if (value == null || String(value).trim() === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      month,
      rows: Array.isArray(rawRows) ? rawRows.map((row: Record<string, unknown>) => ({
        service: String(row.NHOM_DICHVUGB ?? '').trim().toUpperCase(),
        unitGroup: unitGroups.get(String(row.MA_DV ?? '').trim()) ?? String(row.NHOM_DVI ?? '').trim().toUpperCase(),
        unitCode: String(row.MA_DV ?? '').trim(),
        unitName: String(row.TEN_DV ?? '').trim(),
        monthlyPscSubscribers: number(row.TBPSC_THANG),
        monthlyNetPscSubscribers: number(row.TBPSCTT_THANG),
        monthlyRevenue: number(row.DT_THUCHIEN_THANG),
        cumulativeRevenue: number(row.DT_THUCHIEN_LK),
        monthlyRevenuePlan: number(row.DT_KE_HOACH_THANG),
        cumulativeRevenuePlan: number(row.DT_KE_HOACH_THANG_LK),
        annualRevenuePlan: number(row.DT_KE_HOACH_NAM),
      })) : [],
    };
  }

  async fiberDevelopment(month: string) {
    const result = await this.oracleService.executeProcedure(
      'NBH_CDS_NEW.BCGIAOBAN_GLI',
      'SP_VIEW_PTM',
      {
        P_MONTH: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: month.replace('-', '') },
        RSOUT: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      },
    );
    const rawRows = result.outBinds?.RSOUT;
    const number = (value: unknown): number | null => {
      if (value == null || String(value).trim() === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      month,
      rows: Array.isArray(rawRows) ? rawRows.map((row: Record<string, unknown>) => ({
        kpi: String(row.MA_KPI ?? '').trim(),
        kpiName: String(row.TEN_KPI ?? '').trim(),
        unitGroup: String(row.NHOM_DVI ?? '').trim().toUpperCase(),
        unitCode: String(row.MA_DV ?? '').trim(),
        unitName: String(row.TEN_DV ?? '').trim(),
        plan: number(row.KE_HOACH_THANG),
        actual: number(row.THUCHIEN_THANG),
        cumulativePlan: number(row.KE_HOACH_THANG_LK),
        cumulativeActual: number(row.THUCHIEN_LK),
        annualPlan: number(row.KE_HOACH_NAM),
      })) : [],
    };
  }

  async subscriberMovement(month: string) {
    const [year, monthNumber] = month.split('-').map(Number);
    const monthText = String(monthNumber).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const result = await this.oracleService.executeProcedure(
      'NBH_CDS_NEW.GLI_BAOCAO',
      'TH_TANGGIAMTB_DB',
      {
        P_TUNGAY: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `01/${monthText}/${year}` },
        P_DENNGAY: { dir: oracledb.BIND_IN, type: oracledb.STRING, val: `${lastDay}/${monthText}/${year}` },
        P_RS: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      },
    );
    const fields = [
      ...['CD', 'GP', 'IMS', 'MESH', 'FTTX', 'MYTV'].flatMap(prefix =>
        ['PT', 'HUY', 'NG', 'KP', 'TT'].map(suffix => `${prefix}_${suffix}`)),
      'IMS_CD', 'FTTX_PT_GPON', 'FTTX_PT_SW', 'FTTX_PT_CD', 'FTTX_KPTL',
      'FTTX_H_TD', 'FTTX_HUY_TT', 'MYTV_PT_APP', 'MYTV_KPTL', 'MYTV_H_TD', 'MYTV_HUY_TT',
    ];
    const rawRows = result.outBinds?.P_RS;
    return {
      month,
      rows: Array.isArray(rawRows) ? rawRows.map((raw: Record<string, unknown>) => {
        const text = (key: string) => String(raw[key] ?? '').trim();
        const values: Record<string, number | null> = {};
        for (const field of fields) {
          const value = raw[field];
          const parsed = value == null || String(value).trim() === '' ? NaN : Number(value);
          values[field] = Number.isFinite(parsed) ? parsed : null;
        }
        return {
          centerCode: text('MA_TTVT'), centerName: text('TTVT'),
          teamCode: text('MA_TOVT'), teamName: text('TOVT'),
          areaCode: text('KHUVUC_ID'), areaName: text('DIA_BAN'), values,
        };
      }) : [],
    };
  }

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
              WHERE KPI IN ('F1.MYTV_C2', 'F1.FIBER_C2', 'F1.DITT_C2', 'F4.3_C2', 'F4.1_C2', 'F1.CAM_C2', 'F1.MESH_C2')
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
