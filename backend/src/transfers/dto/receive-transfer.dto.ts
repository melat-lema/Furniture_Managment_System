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

export class ReceivedItemDto {
  @IsUUID('all', { message: 'Choose a product.' })
  productId!: string;

  @Type(() => Number)
  @IsInt({ message: 'Enter a whole number.' })
  @Min(0, { message: 'The quantity cannot be negative.' })
  @Max(100_000, { message: 'That quantity is too large.' })
  quantityReceived!: number;
}

export class ReceiveTransferDto {
  @IsArray({ message: 'Confirm every product.' })
  @ArrayMinSize(1, { message: 'Confirm every product.' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReceivedItemDto)
  items!: ReceivedItemDto[];

  /** Required when what arrived differs from what was sent. */
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(300, { message: 'The note is too long (300 characters at most).' })
  note?: string | null;
}

export class CancelTransferDto {
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(300, { message: 'The reason is too long (300 characters at most).' })
  reason?: string | null;
}
