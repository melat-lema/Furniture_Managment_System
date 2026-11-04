import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParam } from '../common/decorators/id-param.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  /** GET /api/locations (any signed-in user; the owner gets full details) */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.locations.list(user);
  }

  /** POST /api/locations */
  @Roles('OWNER')
  @Post()
  create(@Body() dto: CreateLocationDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.locations.create(dto, user, req.ip ?? null);
  }

  /** PATCH /api/locations/:id  (rename, address, phone, activate or deactivate) */
  @Roles('OWNER')
  @Patch(':id')
  update(
    @IdParam() id: string,
    @Body() dto: UpdateLocationDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.locations.update(id, dto, user, req.ip ?? null);
  }
}
