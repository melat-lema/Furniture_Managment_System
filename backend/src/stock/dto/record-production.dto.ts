import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { trimToNull } from '../../common/utils/transforms';

export class ProductionItemDto {
  @IsUUID('all', { message: 'Choose a product.' })
  productId!: string;

  @Type(() => Number)
  @IsInt({ message: 'Enter a whole number.' })
  @Min(1, { message: 'Enter at least 1.' })
  @Max(100_000, { message: 'That quantity is too large.' })
  quantity!: number;
}

export class RecordProductionDto {
  @IsArray({ message: 'Add at least one product.' })
  @ArrayMinSize(1, { message: 'Add at least one product.' })
  @ArrayMaxSize(50, { message: 'You can record up to 50 products at a time.' })
  @ValidateNested({ each: true })
  @Type(() => ProductionItemDto)
  items!: ProductionItemDto[];

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(300, { message: 'The note is too long (300 characters at most).' })
  note?: string | null;
}
