import { Module } from '@nestjs/common';
import { MenuRepository } from './menu.repository.js';
import { MenuService } from './menu.service.js';

@Module({
  providers: [MenuRepository, MenuService],
  exports: [MenuService],
})
export class MenuModule {}
