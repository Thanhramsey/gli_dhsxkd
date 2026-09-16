import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { OracleHealth } from './database/oracle.service.js';

@ApiTags('health')
@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Check whether the API is running' })
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }

  @Get('oracle')
  @ApiOperation({ summary: 'Check the live Oracle connection with SYSDATE' })
  getOracleHealth(): Promise<OracleHealth> {
    return this.appService.getOracleHealth();
  }
}
