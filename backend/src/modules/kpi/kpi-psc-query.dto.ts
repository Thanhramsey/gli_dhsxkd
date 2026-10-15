import { IsIn } from 'class-validator';
import { KpiQueryDto } from './kpi-query.dto.js';

export const KPI_PSC_PROCEDURES = [
  'TYLE_NGUNG_PSC_FIBER',
  'TYLE_NGUNG_PSC_MYTV',
] as const;

export type KpiPscProcedure = (typeof KPI_PSC_PROCEDURES)[number];

export class KpiPscQueryDto extends KpiQueryDto {
  @IsIn(KPI_PSC_PROCEDURES)
  procedure!: KpiPscProcedure;
}
