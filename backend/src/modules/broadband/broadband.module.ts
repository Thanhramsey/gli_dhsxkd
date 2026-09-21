import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BroadbandController } from './broadband.controller.js';
import { BroadbandService } from './broadband.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BroadbandController],
  providers: [BroadbandService],
})
export class BroadbandModule {}
