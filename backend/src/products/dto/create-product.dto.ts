import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trim, trimToNull } from '../../common/utils/transforms';

export const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateProductDto {
  @Transform(trim)
  @IsString({ message: 'Enter the product name.' })
  @Length(2, 120, { message: 'The name must be between 2 and 120 characters.' })
  name!: string;

  @Transform(upperTrim)
  @IsString({ message: 'Enter a product code (SKU).' })
  @Matches(/^[A-Z0-9][A-Z0-9._-]{1,39}$/, {
    message: 'Use 2 to 40 letters, numbers, dots, dashes or underscores, for example SOFA-001.',
  })
  sku!: string;

  @IsUUID('all', { message: 'Choose a category.' })
  categoryId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Enter a valid price with at most 2 decimals.' })
  @Min(0, { message: 'The price cannot be negative.' })
  @Max(100_000_000, { message: 'That price is too high.' })
  price!: number;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(100, { message: 'The material is too long.' })
  material?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(100, { message: 'The dimensions are too long.' })
  dimensions?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(2000, { message: 'The description is too long (2000 characters at most).' })
  description?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'isPublished must be true or false.' })
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be true or false.' })
  isActive?: boolean;
}
