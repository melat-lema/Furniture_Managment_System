import { Body, Controller, Get, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { MAX_RECEIPT_BYTES } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParam } from '../common/decorators/id-param.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SALES_ROLES } from '../common/permissions';
import type { AuthUser } from '../common/types/auth-user';
import { AddPaymentDto, CreateSaleDto, ListSalesQueryDto } from './dto/sales.dto';
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
