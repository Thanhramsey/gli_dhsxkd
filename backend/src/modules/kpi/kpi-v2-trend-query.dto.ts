import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { KpiQueryDto } from './kpi-query.dto.js';

export class KpiV2TrendQueryDto extends KpiQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  kpi!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  unitCode!: string;
}
