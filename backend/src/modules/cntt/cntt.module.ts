import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CnttController } from './cntt.controller.js';
import { CnttService } from './cntt.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CnttController],
  providers: [CnttService],
})
export class CnttModule {}
