import { IsIn } from 'class-validator';
import { KpiQueryDto } from './kpi-query.dto.js';

export const KPI_TREND_PROCEDURES = [
  'TONG_HOP_KPI_BRCD',
  'TONG_HOP_KPI_MYTV',
  'TONG_HOP_KPI_CAM_MESH',
  'TONG_HOP_KPI_CAM',
  'TONG_HOP_KPI_MESH',
  'TONG_HOP_KPI_TSL',
  'TONG_HOP_KPI_CNTT',
  'TONG_HOP_KPI_VINA_TS',
] as const;

export type KpiTrendProcedure = (typeof KPI_TREND_PROCEDURES)[number];

export class KpiTrendQueryDto extends KpiQueryDto {
  @IsIn(KPI_TREND_PROCEDURES)
  procedure!: KpiTrendProcedure;
}
