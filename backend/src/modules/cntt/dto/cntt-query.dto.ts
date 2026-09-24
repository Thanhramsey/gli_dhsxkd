import { IsString, Matches } from 'class-validator';

export class CnttQueryDto {
  @IsString()
  @Matches(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/, {
    message: 'Tháng phải có định dạng YYYY-MM',
  })
  month!: string;
}
