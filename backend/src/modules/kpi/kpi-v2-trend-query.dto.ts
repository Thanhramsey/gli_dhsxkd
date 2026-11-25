import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { KpiQueryDto } from './kpi-query.dto.js';
import type { KpiV2Group, PtmUnitScope } from './kpi-v2-group-query.dto.js';

export class KpiV2TrendQueryDto extends KpiQueryDto {
  @IsOptional()
  @IsIn(['actual', 'maintenance', 'ptm'])
  group?: KpiV2Group;

  @IsOptional()
  @IsIn(['area', 'ttvt', 'vnpt'])
  unitScope?: PtmUnitScope;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  kpi!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  unitCode!: string;
}
