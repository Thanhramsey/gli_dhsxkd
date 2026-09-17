import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MenuAdminGuard } from '../menu/menu-admin.guard.js';
import { AdminService } from './admin.service.js';
import {
  AssignIdsDto,
  CreateGroupDto,
  CreateMenuDto,
  CreateUserDto,
  UpdateGroupDto,
  UpdateMenuDto,
  UpdateUserDto,
} from './dto/admin.dto.js';

@ApiTags('admin')
@ApiCookieAuth('dhsxkd_session')
@Controller('admin')
@UseGuards(JwtAuthGuard, MenuAdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Danh sách người dùng và nhóm được gán' })
  users(@Query('search') search?: string) {
    return this.service.users(search);
  }

  @Post('users')
  createUser(@Body() input: CreateUserDto) {
    return this.service.createUser(input);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() input: UpdateUserDto) {
    return this.service.updateUser(id, input);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.service.deleteUser(id);
  }

  @Get('employees')
  employees(@Query('search') search?: string) {
    return this.service.employees(search);
  }

  @Get('groups')
  groups() {
    return this.service.groups();
  }

  @Post('groups')
  createGroup(@Body() input: CreateGroupDto) {
    return this.service.createGroup(input);
  }

  @Patch('groups/:id')
  updateGroup(@Param('id') id: string, @Body() input: UpdateGroupDto) {
    return this.service.updateGroup(id, input);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) {
    return this.service.deleteGroup(id);
  }

  @Put('groups/:id/menus')
  assignGroupMenus(@Param('id') id: string, @Body() input: AssignIdsDto) {
    return this.service.assignGroupMenus(id, input);
  }

  @Get('menus')
  menus() {
    return this.service.menuCatalog();
  }

  @Post('menus')
  createMenu(@Body() input: CreateMenuDto) {
    return this.service.createMenu(input);
  }

  @Patch('menus/:id')
  updateMenu(@Param('id') id: string, @Body() input: UpdateMenuDto) {
    return this.service.updateMenu(id, input);
  }

  @Delete('menus/:id')
  deleteMenu(@Param('id') id: string) {
    return this.service.deleteMenu(id);
  }
}
