import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { KpiController } from './kpi.controller.js';
import { KpiService } from './kpi.service.js';

@Module({
  imports: [AuthModule],
  controllers: [KpiController],
  providers: [KpiService],
})
export class KpiModule {}
