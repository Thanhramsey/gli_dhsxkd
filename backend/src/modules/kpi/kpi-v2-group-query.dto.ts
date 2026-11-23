import { IsIn, IsOptional } from 'class-validator';
import { KpiQueryDto } from './kpi-query.dto.js';

export type KpiV2Group = 'actual' | 'maintenance';

export class KpiV2GroupQueryDto {
  @IsOptional()
  @IsIn(['actual', 'maintenance'])
  group?: KpiV2Group;
}

export class KpiV2ReportQueryDto extends KpiQueryDto {
  @IsOptional()
  @IsIn(['actual', 'maintenance'])
  group?: KpiV2Group;
}
