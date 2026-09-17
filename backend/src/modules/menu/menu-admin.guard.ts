import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedRequest } from '../auth/auth.types.js';

@Injectable()
export class MenuAdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    const requiredCode = this.configService.get<string>(
      'app.menuAdminCode',
      'MENU_MANAGEMENT',
    );
    const adminGroupIds = this.configService.get<string[]>(
      'app.adminGroupIds',
      ['1'],
    );
    if (
      user?.menuCodes.includes(requiredCode) ||
      user?.groupIds.some((groupId) => adminGroupIds.includes(groupId))
    ) {
      return true;
    }
    throw new ForbiddenException('Bạn không có quyền quản lý menu');
  }
}
