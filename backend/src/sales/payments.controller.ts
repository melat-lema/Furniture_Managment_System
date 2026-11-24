import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParam } from '../common/decorators/id-param.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SALES_ROLES } from '../common/permissions';
import type { AuthUser } from '../common/types/auth-user';
import { BulkVerifyDto, ListPaymentsQueryDto, RejectPaymentDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';
import { SalesService } from './sales.service';

/** The owner checks payments here. A showroom can only read its own (to see what was rejected). */
@Roles(...SALES_ROLES)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly sales: SalesService,
  ) {}

  /** GET /api/payments?status=UNVERIFIED&overdue=true&method=&locationId=&search=&page= */
  @Get()
  list(@Query() query: ListPaymentsQueryDto, @CurrentUser() user: AuthUser) {
    return this.payments.list(query, user);
  }

  /** GET /api/payments/summary (counts for the dashboards and the sidebar badge) */
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.payments.summary(user);
  }

  /** POST /api/payments/bulk-verify  { ids: [...] } */
  @Roles('OWNER')
  @Post('bulk-verify')
  @HttpCode(HttpStatus.OK)
  bulkVerify(@Body() dto: BulkVerifyDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.payments.bulkVerify(dto, user, req.ip ?? null);
  }

  /** GET /api/payments/:id/receipt  ->  { url, expiresInSeconds, kind }  (a link that works for 5 minutes) */
  @Get(':id/receipt')
  @Header('Cache-Control', 'no-store')
  receipt(@IdParam() id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.sales.receiptLink(id, user, req.ip ?? null);
  }

  @Roles('OWNER')
  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  verify(@IdParam() id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.payments.verify(id, user, req.ip ?? null);
  }

  @Roles('OWNER')
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@IdParam() id: string, @Body() dto: RejectPaymentDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.payments.reject(id, dto, user, req.ip ?? null);
  }
}
