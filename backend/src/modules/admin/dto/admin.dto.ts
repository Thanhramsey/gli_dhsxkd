import { Type } from 'class-transformer';
import {
  ArrayUnique,
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
  @IsArray() @ArrayUnique() @IsString({ each: true }) groupIds!: string[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() @IsNotEmpty() employeeId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 1]) status?: number;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) groupIds?: string[];
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
