import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard, SESSION_COOKIE } from './jwt-auth.guard.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Temporary account-only login using MA_ND' })
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.login(input.account);
    response.cookie(SESSION_COOKIE, token, this.cookieOptions());
    return { user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Return the current user profile and menu permissions',
  })
  me(@CurrentUser() user: AuthenticatedUser): { user: AuthenticatedUser } {
    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.configService.get<boolean>('app.secureCookie', false),
      maxAge:
        this.configService.get<number>('app.sessionTtlSeconds', 28_800) * 1_000,
      path: '/',
    };
  }
}
