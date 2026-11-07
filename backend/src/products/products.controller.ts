import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type {Multer} from 'multer';
import { MAX_IMAGE_BYTES } from '../common/constants';
import { PRODUCT_MANAGERS } from '../common/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParam } from '../common/decorators/id-param.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** GET /api/products?search=&categoryId=&isActive=&isPublished=&sort=&page=&pageSize= (any signed-in user) */
  @Get()
  list(@Query() query: ListProductsQueryDto, @CurrentUser() user: AuthUser) {
    return this.products.list(query, user);
  }

  /** GET /api/products/price-changes (owner only). Must stay above the :id route. */
  @Roles('OWNER')
  @Get('price-changes')
  priceChanges() {
    return this.products.priceChanges();
  }

  @Get(':id')
  get(@IdParam() id: string, @CurrentUser() user: AuthUser) {
    return this.products.get(id, user);
  }

  @Roles(...PRODUCT_MANAGERS)
  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.products.create(dto, user, req.ip ?? null);
  }

  /** Products are never deleted (stock and sales history point to them). Set isActive=false instead. */
  @Roles(...PRODUCT_MANAGERS)
  @Patch(':id')
  update(@IdParam() id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.products.update(id, dto, user, req.ip ?? null);
  }

  /** POST /api/products/:id/image  (multipart form, field name "file") */
  @Roles(...PRODUCT_MANAGERS)
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  uploadImage(
    @IdParam() id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.products.setImage(id, file, user, req.ip ?? null);
  }

  @Roles(...PRODUCT_MANAGERS)
  @Delete(':id/image')
  removeImage(@IdParam() id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.products.removeImage(id, user, req.ip ?? null);
  }
}
