import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

export class TransferItemDto {
  @IsUUID('all', { message: 'Choose a product.' })
  productId!: string;

  @Type(() => Number)
  @IsInt({ message: 'Enter a whole number.' })
  @Min(1, { message: 'Enter at least 1.' })
  @Max(100_000, { message: 'That quantity is too large.' })
  quantity!: number;
}

export class CreateTransferDto {
  @IsUUID('all', { message: 'Choose where to send the goods.' })
  toLocationId!: string;

  @IsArray({ message: 'Add at least one product.' })
  @ArrayMinSize(1, { message: 'Add at least one product.' })
  @ArrayMaxSize(50, { message: 'A transfer can hold up to 50 products.' })
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items!: TransferItemDto[];

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(300, { message: 'The note is too long (300 characters at most).' })
  note?: string | null;

  /** true = save and send in one step */
  @IsOptional()
  @IsBoolean()
  sendNow?: boolean;
}

export class UpdateTransferDto {
  @IsOptional()
  @IsUUID('all', { message: 'Choose where to send the goods.' })
  toLocationId?: string;

  @IsOptional()
  @IsArray({ message: 'Add at least one product.' })
  @ArrayMinSize(1, { message: 'Add at least one product.' })
  @ArrayMaxSize(50, { message: 'A transfer can hold up to 50 products.' })
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items?: TransferItemDto[];

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(300, { message: 'The note is too long (300 characters at most).' })
  note?: string | null;
}
