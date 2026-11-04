import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean, trimToUndefined } from '../../common/utils/transforms';

export class ListProductsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID('all')
  categoryId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsIn(['name', 'newest'])
  sort?: 'name' | 'newest';
}
