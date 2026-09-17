import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthenticatedRequest, SessionPayload } from './auth.types.js';

export const SESSION_COOKIE = 'dhsxkd_session';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request.headers);
    if (!token) throw new UnauthorizedException('Bạn chưa đăng nhập');

    let payload: SessionPayload;
    try {
      payload = await this.jwtService.verifyAsync<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn hoặc không hợp lệ',
      );
    }

    request.user = await this.authService.resolveSession(payload);
    return true;
  }

  private extractToken(
    headers: AuthenticatedRequest['headers'],
  ): string | null {
    const authorization = this.first(headers.authorization);
    if (authorization?.startsWith('Bearer ')) return authorization.slice(7);

    const cookie = this.first(headers.cookie);
    if (!cookie) return null;
    for (const part of cookie.split(';')) {
      const [name, ...value] = part.trim().split('=');
      if (name === SESSION_COOKIE) {
        try {
          return decodeURIComponent(value.join('='));
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
