import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BroadbandService } from './broadband.service.js';
import { BroadbandQueryDto } from './dto/broadband-query.dto.js';

@ApiTags('broadband')
@ApiCookieAuth('dhsxkd_session')
@Controller('broadband')
@UseGuards(JwtAuthGuard)
export class BroadbandController {
  constructor(private readonly service: BroadbandService) {}

  @Get('units')
  @ApiOperation({ summary: 'Danh mục đơn vị dùng để lọc báo cáo băng rộng' })
  units() {
    return this.service.units();
  }

  @Get('procedures')
  @ApiOperation({ summary: 'Danh sách báo cáo trong package PACK_BR' })
  procedures() {
    return this.service.procedures();
  }

  @Post('procedures/:key')
  @ApiOperation({ summary: 'Gọi procedure báo cáo bằng bind variables' })
  execute(@Param('key') key: string, @Body() input: BroadbandQueryDto) {
    return this.service.execute(key, input);
  }
}
