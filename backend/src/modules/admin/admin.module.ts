import { Module } from '@nestjs/common';
import { MenuAdminGuard } from '../menu/menu-admin.guard.js';
import { MenuModule } from '../menu/menu.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AdminController } from './admin.controller.js';
import { AdminRepository } from './admin.repository.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [AuthModule, MenuModule],
  controllers: [AdminController],
  providers: [AdminRepository, AdminService, MenuAdminGuard],
})
export class AdminModule {}
