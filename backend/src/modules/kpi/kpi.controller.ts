import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { KpiQueryDto } from './kpi-query.dto.js';
import { KpiService } from './kpi.service.js';

@ApiTags('kpi')
@ApiCookieAuth('dhsxkd_session')
@Controller('kpi')
@UseGuards(JwtAuthGuard)
export class KpiController {
  constructor(private readonly service: KpiService) {}

  @Get('latest-month')
  @ApiOperation({ summary: 'Tháng có dữ liệu KPI gần nhất' })
  latestMonth() {
    return this.service.latestMonth();
  }

  @Post('summary')
  @ApiOperation({ summary: 'Tổng hợp KPI theo tháng (MA_KPI_GLI_TONG)' })
  summary(@Body() input: KpiQueryDto) {
    return this.service.summary(input);
  }
}
