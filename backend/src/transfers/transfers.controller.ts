import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParam } from '../common/decorators/id-param.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { CreateTransferDto, UpdateTransferDto } from './dto/create-transfer.dto';
import { ListTransfersQueryDto } from './dto/list-transfers-query.dto';
import { CancelTransferDto, ReceiveTransferDto } from './dto/receive-transfer.dto';
import { TransfersService } from './transfers.service';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  /** GET /api/transfers?status=&direction=&locationId=&search=&page= */
  @Get()
  list(@Query() query: ListTransfersQueryDto, @CurrentUser() user: AuthUser) {
    return this.transfers.list(query, user);
  }

  /** GET /api/transfers/summary (counts for dashboards). Must stay above the :id route. */
  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.transfers.summary(user);
  }

  @Get(':id')
  get(@IdParam() id: string, @CurrentUser() user: AuthUser) {
    return this.transfers.get(id, user);
  }

  /** POST /api/transfers  { toLocationId, items: [{ productId, quantity }], note?, sendNow? } */
  @Roles('WORKSHOP_MANAGER', 'STORE_MANAGER')
  @Post()
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.transfers.create(dto, user, req.ip ?? null);
  }

  /** PATCH /api/transfers/:id  (drafts only) */
  @Roles('WORKSHOP_MANAGER', 'STORE_MANAGER')
  @Patch(':id')
  update(@IdParam() id: string, @Body() dto: UpdateTransferDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.transfers.update(id, dto, user, req.ip ?? null);
  }

  @Roles('WORKSHOP_MANAGER', 'STORE_MANAGER')
  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  send(@IdParam() id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.transfers.send(id, user, req.ip ?? null);
  }

  /** POST /api/transfers/:id/receive  { items: [{ productId, quantityReceived }], note? } */
  @Roles('STORE_MANAGER', 'SHOWROOM')
  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  receive(@IdParam() id: string, @Body() dto: ReceiveTransferDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.transfers.receive(id, dto, user, req.ip ?? null);
  }

  @Roles('OWNER', 'WORKSHOP_MANAGER', 'STORE_MANAGER')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@IdParam() id: string, @Body() dto: CancelTransferDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.transfers.cancel(id, dto, user, req.ip ?? null);
  }
}
