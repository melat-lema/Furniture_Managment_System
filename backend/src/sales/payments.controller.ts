import { Controller, Get, Header, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParam } from '../common/decorators/id-param.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SALES_ROLES } from '../common/permissions';
import type { AuthUser } from '../common/types/auth-user';
import { SalesService } from './sales.service';

@Roles(...SALES_ROLES)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly sales: SalesService) {}

  /** GET /api/payments/:id/receipt  ->  { url, expiresInSeconds, kind }  (a link that works for 5 minutes) */
  @Get(':id/receipt')
  @Header('Cache-Control', 'no-store')
  receipt(@IdParam() id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.sales.receiptLink(id, user, req.ip ?? null);
  }
}
