import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { STOCK_VIEWERS } from '../common/permissions';
import type { AuthUser } from '../common/types/auth-user';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { RecordProductionDto } from './dto/record-production.dto';
import { StockLevelsQueryDto, StockMovementsQueryDto, StockOverviewQueryDto } from './dto/stock-queries.dto';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  /** POST /api/stock/production  { items: [{ productId, quantity }], note? }  (workshop manager only) */
  @Roles('WORKSHOP_MANAGER')
  @Post('production')
  recordProduction(@Body() dto: RecordProductionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.stock.recordProduction(dto, user, req.ip ?? null);
  }

  /** POST /api/stock/adjustments  { productId, quantity (+/-), reason, note?, locationId? (owner) } */
  @Roles('OWNER', 'WORKSHOP_MANAGER', 'STORE_MANAGER')
  @Post('adjustments')
  @HttpCode(HttpStatus.CREATED)
  adjust(@Body() dto: AdjustStockDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.stock.adjust(dto, user, req.ip ?? null);
  }

  /** GET /api/stock/levels  (own location; the owner and workshop manager must pass locationId) */
  @Get('levels')
  levels(@Query() query: StockLevelsQueryDto, @CurrentUser() user: AuthUser) {
    return this.stock.levels(query, user);
  }

  /** GET /api/stock/overview  (owner and workshop manager: all products x all locations) */
  @Roles(...STOCK_VIEWERS)
  @Get('overview')
  overview(@Query() query: StockOverviewQueryDto) {
    return this.stock.overview(query);
  }

  /** GET /api/stock/movements  (the ledger) */
  @Get('movements')
  movements(@Query() query: StockMovementsQueryDto, @CurrentUser() user: AuthUser) {
    return this.stock.movements(query, user);
  }

  /** GET /api/stock/summary  (dashboard numbers) */
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.stock.summary(user);
  }
}
