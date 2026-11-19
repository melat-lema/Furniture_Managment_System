import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Roles('OWNER')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list() {
    return this.settings.list();
  }

  /** PATCH /api/settings  { low_stock_threshold?, max_discount_percent? } */
  @Patch()
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.settings.update(dto, user, req.ip ?? null);
  }
}
