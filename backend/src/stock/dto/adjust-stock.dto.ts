import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, NotEquals } from 'class-validator';
import { trimToNull } from '../../common/utils/transforms';
import { ADJUSTMENT_REASONS, type AdjustmentReason } from '../../common/types/stock';

export class AdjustStockDto {
  @IsUUID('all', { message: 'Choose a product.' })
  productId!: string;

  /** The owner must say which location. Managers adjust their own location automatically. */
  @IsOptional()
  @Transform(trimToNull)
  @IsUUID('all', { message: 'Choose a location.' })
  locationId?: string | null;

  /** Positive adds stock, negative removes it. */
  @Type(() => Number)
  @IsInt({ message: 'Enter a whole number.' })
  @NotEquals(0, { message: 'Enter a number other than 0.' })
  @Min(-100_000, { message: 'That quantity is too large.' })
  @Max(100_000, { message: 'That quantity is too large.' })
  quantity!: number;

  @IsIn(ADJUSTMENT_REASONS, { message: 'Choose a reason.' })
  reason!: AdjustmentReason;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(300, { message: 'The note is too long (300 characters at most).' })
  note?: string | null;
}
