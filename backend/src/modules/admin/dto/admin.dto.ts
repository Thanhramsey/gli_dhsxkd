import { Type } from 'class-transformer';
import {
  ArrayUnique,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateUserDto {
  @IsString() @IsNotEmpty() @MaxLength(100) account!: string;
  @IsString() @IsNotEmpty() employeeId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status = 1;
  @IsArray() @ArrayUnique() @ArrayMaxSize(1) @IsString({ each: true }) groupIds!: string[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() @IsNotEmpty() employeeId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(1) @IsString({ each: true }) groupIds?: string[];
}

export class CreateGroupDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
}

export class UpdateGroupDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
}

export class AssignIdsDto {
  @IsArray() @ArrayUnique() @IsString({ each: true }) ids!: string[];
}

export class CreateReportGroupDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class UpdateReportGroupDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class CreateReportDto {
  @IsString() @IsNotEmpty() @MaxLength(500) name!: string;
  @IsOptional() @IsString() sql?: string;
  @IsOptional() @IsString() @MaxLength(500) tm1?: string;
  @IsOptional() @IsString() @MaxLength(500) tm2?: string;
  @IsOptional() @IsString() @MaxLength(500) tm3?: string;
  @IsOptional() @IsString() @MaxLength(500) tm4?: string;
  @IsOptional() @IsString() @MaxLength(500) tm5?: string;
  @IsOptional() @IsString() @MaxLength(500) tm6?: string;
  @IsOptional() @IsString() @MaxLength(500) tm7?: string;
  @IsOptional() @IsString() @MaxLength(500) reportView?: string;
  @IsOptional() @IsString() @MaxLength(500) reportExport?: string;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsString() @MaxLength(500) procedurePackage?: string;
}

export class UpdateReportDto extends CreateReportDto {}

export class CreateMenuDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(255) url?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) orderIndex?: number;
  @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @IsBoolean() isHeading!: boolean;
}

export class UpdateMenuDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(255) url?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) orderIndex?: number;
  @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @IsOptional() @IsBoolean() isHeading?: boolean;
}
