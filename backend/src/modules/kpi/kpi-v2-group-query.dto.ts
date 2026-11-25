import { IsIn, IsOptional } from 'class-validator';
import { KpiQueryDto } from './kpi-query.dto.js';

export type KpiV2Group = 'actual' | 'maintenance' | 'ptm';
export type PtmUnitScope = 'area' | 'ttvt' | 'vnpt';

export class KpiV2GroupQueryDto {
  @IsOptional()
  @IsIn(['actual', 'maintenance', 'ptm'])
  group?: KpiV2Group;
}

export class KpiV2ReportQueryDto extends KpiQueryDto {
  @IsOptional()
  @IsIn(['actual', 'maintenance', 'ptm'])
  group?: KpiV2Group;

  @IsOptional()
  @IsIn(['area', 'ttvt', 'vnpt'])
  unitScope?: PtmUnitScope;
}
