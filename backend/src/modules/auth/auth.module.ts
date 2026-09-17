import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { MenuModule } from '../menu/menu.module.js';
import { MenuAdminGuard } from '../menu/menu-admin.guard.js';
import { MenuController } from '../menu/menu.controller.js';

@Global()
@Module({
  imports: [
    MenuModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('app.jwtSecret'),
      }),
    }),
  ],
  controllers: [AuthController, MenuController],
  providers: [AuthRepository, AuthService, JwtAuthGuard, MenuAdminGuard],
  exports: [JwtModule, AuthService, JwtAuthGuard, MenuAdminGuard],
})
export class AuthModule {}
