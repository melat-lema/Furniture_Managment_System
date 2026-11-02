import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { REFRESH_COOKIE } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { clearAuthCookies, type CookieConfig, readCookieConfig, setAuthCookies } from './auth-cookies';
import { AuthService, type SessionMeta } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { publicUserFromAuth } from './public-user';

function metaFrom(req: Request): SessionMeta {
  const userAgent = req.headers['user-agent'];
  return {
    ip: req.ip ?? null,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 255) : null,
  };
}

function refreshTokenFrom(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE];
}

@Controller('auth')
export class AuthController {
  private readonly cookieConfig: CookieConfig;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cookieConfig = readCookieConfig(config);
  }

  /** POST /api/auth/login  { email, password } */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.login(dto, metaFrom(req));
    setAuthCookies(res, this.cookieConfig, tokens);
    return { user };
  }

  /** POST /api/auth/refresh  (uses the refresh cookie) */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.refresh(refreshTokenFrom(req), metaFrom(req));
    setAuthCookies(res, this.cookieConfig, tokens);
    return { user };
  }

  /** POST /api/auth/logout  (always succeeds) */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(refreshTokenFrom(req));
    clearAuthCookies(res, this.cookieConfig);
  }

  /** GET /api/auth/me */
  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@CurrentUser() user: AuthUser) {
    return { user: publicUserFromAuth(user) };
  }

  /** POST /api/auth/change-password  { currentPassword, newPassword } */
  @Post('change-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.changePassword(user, dto, metaFrom(req));
  }
}
