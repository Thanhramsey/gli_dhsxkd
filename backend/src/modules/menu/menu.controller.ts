import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MenuAdminGuard } from './menu-admin.guard.js';
import { MenuService } from './menu.service.js';

@ApiTags('menus')
@Controller('menus')
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Return the current user menu tree' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.menuService.getMenuTree(user.groupIds);
  }

  @Get('catalog')
  @UseGuards(MenuAdminGuard)
  @ApiOperation({ summary: 'Return the menu catalog for menu administration' })
  catalog() {
    return this.menuService.getCatalog();
  }

  @Get('groups')
  @UseGuards(MenuAdminGuard)
  @ApiOperation({ summary: 'Return user groups available for menu assignment' })
  groups() {
    return this.menuService.getGroups();
  }
}
