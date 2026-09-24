import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CnttService } from './cntt.service.js';
import { CnttQueryDto } from './dto/cntt-query.dto.js';

@ApiTags('cntt')
@ApiCookieAuth('dhsxkd_session')
@Controller('cntt')
@UseGuards(JwtAuthGuard)
export class CnttController {
  constructor(private readonly service: CnttService) {}

  @Post('revenue')
  @ApiOperation({ summary: 'Doanh thu CNTT theo tháng và đơn vị (PACK_CNTT)' })
  revenue(@Body() input: CnttQueryDto) {
    return this.service.revenue(input);
  }
}
