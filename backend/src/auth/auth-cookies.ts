import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH } from '../common/constants';

export interface CookieConfig {
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
}

export function readCookieConfig(config: ConfigService): CookieConfig {
  const raw = (config.get<string>('COOKIE_SAMESITE') ?? 'lax').toLowerCase();
  const sameSite: CookieConfig['sameSite'] = raw === 'strict' || raw === 'none' ? raw : 'lax';
  // Browsers refuse SameSite=None cookies that are not Secure.
  const secure = config.get<string>('COOKIE_SECURE') === 'true' || sameSite === 'none';
  const accessSeconds = Number(config.get<string>('ACCESS_TOKEN_TTL_SECONDS') ?? 900);
  const refreshDays = Number(config.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? 7);
  return {
    secure,
    sameSite,
    accessMaxAgeMs: accessSeconds * 1000,
    refreshMaxAgeMs: refreshDays * 86_400_000,
  };
}

function baseOptions(cfg: CookieConfig): CookieOptions {
  // httpOnly: JavaScript in the browser can never read these cookies.
  return { httpOnly: true, secure: cfg.secure, sameSite: cfg.sameSite };
}

export function setAuthCookies(
  res: Response,
  cfg: CookieConfig,
  tokens: { accessToken: string; refreshToken: string },
): void {
  res.setHeader('Cache-Control', 'no-store');
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...baseOptions(cfg), path: '/', maxAge: cfg.accessMaxAgeMs });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(cfg),
    path: REFRESH_COOKIE_PATH,
    maxAge: cfg.refreshMaxAgeMs,
  });
}

export function clearAuthCookies(res: Response, cfg: CookieConfig): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(cfg), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(cfg), path: REFRESH_COOKIE_PATH });
}
