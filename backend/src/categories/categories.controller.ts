import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PRODUCT_MANAGERS } from '../common/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParam } from '../common/decorators/id-param.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { CategoriesService } from './categories.service';
import { CategoryDto } from './dto/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** GET /api/categories (any signed-in user: needed for dropdowns) */
  @Get()
  list() {
    return this.categories.list();
  }

  @Roles(...PRODUCT_MANAGERS)
  @Post()
  create(@Body() dto: CategoryDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.categories.create(dto, user, req.ip ?? null);
  }

  @Roles(...PRODUCT_MANAGERS)
  @Patch(':id')
  update(@IdParam() id: string, @Body() dto: CategoryDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.categories.update(id, dto, user, req.ip ?? null);
  }

  @Roles(...PRODUCT_MANAGERS)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@IdParam() id: string, @CurrentUser() user: AuthUser, @Req() req: Request): Promise<void> {
    await this.categories.remove(id, user, req.ip ?? null);
  }
}
