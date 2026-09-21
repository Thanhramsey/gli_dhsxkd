import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Matches, Min } from 'class-validator';

export class BroadbandQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fromDate!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) toDate!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) unitId = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) serviceId = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) subscriberTypeId = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) areaId = 0;
}
