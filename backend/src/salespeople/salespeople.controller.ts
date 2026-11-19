import { Body, Controller, Get, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParam } from '../common/decorators/id-param.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SALES_ROLES } from '../common/permissions';
import type { AuthUser } from '../common/types/auth-user';
import { CreateSalespersonDto, ListSalespeopleQueryDto, UpdateSalespersonDto } from './dto/salesperson.dto';
import { SalespeopleService } from './salespeople.service';

/** The showroom manages its own list; the owner can see and manage every showroom's. */
@Roles(...SALES_ROLES)
@Controller('salespeople')
export class SalespeopleController {
  constructor(private readonly salespeople: SalespeopleService) {}

  /** GET /api/salespeople?includeInactive=true&showroomId=(owner) */
  @Get()
  list(@Query() query: ListSalespeopleQueryDto, @CurrentUser() user: AuthUser) {
    return this.salespeople.list(query, user);
  }

  @Post()
  create(@Body() dto: CreateSalespersonDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.salespeople.create(dto, user, req.ip ?? null);
  }

  /** PATCH /api/salespeople/:id  (rename, phone, deactivate or reactivate; never deleted, sales keep the name) */
  @Patch(':id')
  update(@IdParam() id: string, @Body() dto: UpdateSalespersonDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.salespeople.update(id, dto, user, req.ip ?? null);
  }
}
