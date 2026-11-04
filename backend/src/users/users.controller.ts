import { Body, Controller, Get, Header, HttpCode, HttpStatus, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParam } from '../common/decorators/id-param.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

/** Everything here is for the owner only. */
@Roles('OWNER')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  /** Returns the new user and a temporary password (shown once). */
  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.users.create(dto, user, req.ip ?? null);
  }

  @Patch(':id')
  update(@IdParam() id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.users.update(id, dto, user, req.ip ?? null);
  }

  @Patch(':id/active')
  setActive(@IdParam() id: string, @Body() dto: SetActiveDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.users.setActive(id, dto.isActive, user, req.ip ?? null);
  }

  /** Returns a new temporary password (shown once) and signs the person out everywhere. */
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  resetPassword(@IdParam() id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.users.resetPassword(id, user, req.ip ?? null);
  }

  @Post(':id/force-logout')
  @HttpCode(HttpStatus.OK)
  forceLogout(@IdParam() id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.users.forceLogout(id, user, req.ip ?? null);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlock(@IdParam() id: string, @CurrentUser() user: AuthUser, @Req() req: Request): Promise<void> {
    await this.users.unlock(id, user, req.ip ?? null);
  }
}
