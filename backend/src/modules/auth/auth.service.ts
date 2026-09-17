import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MenuService } from '../menu/menu.service.js';
import { AuthRepository, UserRecord } from './auth.repository.js';
import { AuthenticatedUser, SessionPayload } from './auth.types.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly menuService: MenuService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    account: string,
  ): Promise<{ token: string; user: AuthenticatedUser }> {
    const record = await this.authRepository.findByAccount(account);
    if (!record || !this.isActive(record.status)) {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã ngừng hoạt động',
      );
    }

    const user = await this.toAuthenticatedUser(record);
    const payload: SessionPayload = {
      sub: user.userId,
      account: user.account,
      groupIds: user.groupIds,
      groupId: user.groupId,
    };
    const token = await this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get<number>(
        'app.sessionTtlSeconds',
        28_800,
      ),
    });
    return { token, user };
  }

  async resolveSession(payload: SessionPayload): Promise<AuthenticatedUser> {
    const record = await this.authRepository.findByAccount(payload.account);
    if (!record || !this.isActive(record.status)) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hợp lệ');
    }
    return this.toAuthenticatedUser(record);
  }

  private async toAuthenticatedUser(
    record: UserRecord,
  ): Promise<AuthenticatedUser> {
    const menuCodes = record.groupIds.length
      ? await this.menuService.getPermissionCodes(record.groupIds)
      : [];
    return {
      userId: record.userId,
      account: record.account,
      displayName: record.displayName,
      groupIds: record.groupIds,
      groupId: record.groupId,
      groupName: record.groupName,
      employee: {
        employeeId: record.employeeId,
        employeeCode: record.employeeCode,
        fullName: record.fullName,
        title: record.title,
        phone: record.phone,
        email: record.email,
        unitId: record.unitId,
        unitCode: record.unitCode,
        unitName: record.unitName,
      },
      menuCodes,
      source: record.source,
    };
  }

  private isActive(status: string | null): boolean {
    if (status === null) return true;
    return !['0', 'N', 'INACTIVE', 'LOCKED'].includes(status.toUpperCase());
  }
}
