import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MOVEMENT_REASONS, type MovementReason } from '../../common/types/stock';
import { toBoolean, trimToUndefined } from '../../common/utils/transforms';

export class StockLevelsQueryDto extends PaginationQueryDto {
  /** Required for the owner. Everyone else always sees their own location. */
  @IsOptional()
  @IsUUID('all')
  locationId?: string;

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
  lowOnly?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeZero?: boolean;
}

export class StockOverviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID('all')
  categoryId?: string;
}

export class StockMovementsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('all')
  locationId?: string;

  @IsOptional()
  @IsUUID('all')
  productId?: string;

  @IsOptional()
  @IsIn(MOVEMENT_REASONS)
  reason?: MovementReason;
}
