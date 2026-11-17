import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { KpiQueryDto } from './kpi-query.dto.js';
import { KpiPscQueryDto } from './kpi-psc-query.dto.js';
import { KpiTrendQueryDto } from './kpi-trend-query.dto.js';
import { KpiV2TrendQueryDto } from './kpi-v2-trend-query.dto.js';
import { KpiService } from './kpi.service.js';

@ApiTags('kpi')
@ApiCookieAuth('dhsxkd_session')
@Controller('kpi')
@UseGuards(JwtAuthGuard)
export class KpiController {
  constructor(private readonly service: KpiService) {}

  @Get('v2-months')
  @ApiOperation({ summary: 'Các tháng có dữ liệu giao ban v2' })
  v2Months() {
    return this.service.v2Months();
  }

  @Post('v2-report')
  @ApiOperation({ summary: 'Các KPI doanh thu cấp 3 từ TONGHOP_KPI_ALL theo tháng' })
  v2Report(@Body() input: KpiQueryDto) {
    return this.service.v2Report(input.month);
  }

  @Post('v2-unit-trend')
  @ApiOperation({ summary: 'Doanh thu KPI của một địa bàn từ tháng 1 đến tháng báo cáo' })
  v2UnitTrend(@Body() input: KpiV2TrendQueryDto) {
    return this.service.v2UnitTrend(input);
  }

  @Get('latest-month')
  @ApiOperation({ summary: 'Tháng có dữ liệu KPI gần nhất' })
  latestMonth(@Query('procedure') procedure?: string) {
    return this.service.latestMonth(procedure);
  }

  @Post('summary')
  @ApiOperation({ summary: 'Tổng hợp KPI theo tháng (MA_KPI_GLI_TONG)' })
  summary(@Body() input: KpiQueryDto) {
    return this.service.summary(input);
  }

  @Post('trend')
  @ApiOperation({ summary: 'Doanh thu và thuê bao theo tháng của đầu KPI' })
  trend(@Body() input: KpiTrendQueryDto) {
    return this.service.trend(input);
  }

  @Post('psc')
  @ApiOperation({ summary: 'Tỷ lệ ngừng phát sinh cước Fiber/MyTV theo đơn vị' })
  psc(@Body() input: KpiPscQueryDto) {
    return this.service.psc(input);
  }

  @Post('maintenance')
  @ApiOperation({ summary: 'Doanh thu duy trì Fiber và MyTV theo đơn vị' })
  maintenance(@Body() input: KpiQueryDto) {
    return this.service.maintenance(input.month);
  }

  @Post('subscriber-movement')
  @ApiOperation({ summary: 'Biến động thuê bao theo trung tâm, tổ và địa bàn' })
  subscriberMovement(@Body() input: KpiQueryDto) {
    return this.service.subscriberMovement(input.month);
  }

  @Post('fiber-development')
  @ApiOperation({ summary: 'Kế hoạch và thực hiện phát triển mới Fiber theo nhóm đơn vị' })
  fiberDevelopment(@Body() input: KpiQueryDto) {
    return this.service.fiberDevelopment(input.month);
  }

  @Post('fiber-psc')
  @ApiOperation({ summary: 'Phát sinh cước và doanh thu Fiber theo đơn vị' })
  fiberPsc(@Body() input: KpiQueryDto) {
    return this.service.fiberPsc(input.month);
  }
}
