import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { MAX_RECEIPT_BYTES } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParam } from '../common/decorators/id-param.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SALES_ROLES } from '../common/permissions';
import type { AuthUser } from '../common/types/auth-user';
import { AddPaymentDto, CreateSaleDto, LeaderboardQueryDto, ListSalesQueryDto, UpdateSaleDto, VoidSaleDto } from './dto/sales.dto';
import { SalesService } from './sales.service';

/** The showroom records and sees its own sales; the owner sees every showroom's. */
@Roles(...SALES_ROLES)
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list(@Query() query: ListSalesQueryDto, @CurrentUser() user: AuthUser) {
    return this.sales.list(query, user);
  }

  /** GET /api/sales/summary. Must stay above the :id route. */
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.sales.summary(user);
  }

  /** GET /api/sales/leaderboard?period=today|month|all  (sales per salesperson). Must stay above the :id route. */
  @Get('leaderboard')
  leaderboard(@Query() query: LeaderboardQueryDto, @CurrentUser() user: AuthUser) {
    return this.sales.leaderboard(query, user);
  }

  @Get(':id')
  get(@IdParam() id: string, @CurrentUser() user: AuthUser) {
    return this.sales.get(id, user);
  }

  /** POST /api/sales  { salespersonId, customerName?, customerPhone?, items: [{ productId, quantity }], discount?, discountReason? } */
  @Roles('SHOWROOM')
  @Post()
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.sales.create(dto, user, req.ip ?? null);
  }

  /** PATCH /api/sales/:id  (correct the customer or who sold it; products and prices cannot change) */
  @Patch(':id')
  update(@IdParam() id: string, @Body() dto: UpdateSaleDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.sales.update(id, dto, user, req.ip ?? null);
  }

  /** POST /api/sales/:id/void  { reason }  (cancels the sale and puts the goods back in stock) */
  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  cancel(@IdParam() id: string, @Body() dto: VoidSaleDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.sales.void(id, dto, user, req.ip ?? null);
  }

  /** POST /api/sales/:id/payments  (multipart form: amount, method, referenceNo?, receipt?) */
  @Roles('SHOWROOM')
  @Post(':id/payments')
  @UseInterceptors(FileInterceptor('receipt', { limits: { fileSize: MAX_RECEIPT_BYTES, files: 1 } }))
  addPayment(
    @IdParam() id: string,
    @Body() dto: AddPaymentDto,
    @UploadedFile() receipt: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.sales.addPayment(id, dto, receipt, user, req.ip ?? null);
  }
}
