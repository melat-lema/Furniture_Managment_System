import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  PAYMENT_METHODS,
  SALE_PAYMENT_STATUSES,
  SALE_STATUSES,
  type PaymentMethod,
  type SalePaymentStatus,
  type SaleStatus,
} from '../../common/types/sales';
import { toBoolean, trimToNull, trimToUndefined } from '../../common/utils/transforms';

const PHONE = /^[+\d][\d\s-]{5,19}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class SaleItemDto {
  @IsUUID('all', { message: 'Choose a product.' })
  productId!: string;

  @Type(() => Number)
  @IsInt({ message: 'Enter a whole number.' })
  @Min(1, { message: 'Enter at least 1.' })
  @Max(10_000, { message: 'That quantity is too large.' })
  quantity!: number;
}

export class CreateSaleDto {
  @IsUUID('all', { message: 'Choose who made the sale.' })
  salespersonId!: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(100, { message: 'The customer name is too long.' })
  customerName?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @Matches(PHONE, { message: 'Enter a valid phone number, for example +251 911 000000.' })
  customerPhone?: string | null;

  @IsArray({ message: 'Add at least one product.' })
  @ArrayMinSize(1, { message: 'Add at least one product.' })
  @ArrayMaxSize(50, { message: 'A sale can hold up to 50 products.' })
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  /** A discount in birr (not a percentage). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Enter a valid amount with at most 2 decimals.' })
  @Min(0, { message: 'The discount cannot be negative.' })
  @Max(100_000_000, { message: 'That discount is too large.' })
  discount?: number;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(200, { message: 'The reason is too long (200 characters at most).' })
  discountReason?: string | null;
}

/** Sent as a multipart form (because of the receipt file), so every field arrives as text first. */
export class AddPaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Enter a valid amount with at most 2 decimals.' })
  @Min(0.01, { message: 'The amount must be more than 0.' })
  @Max(100_000_000, { message: 'That amount is too large.' })
  amount!: number;

  @IsIn(PAYMENT_METHODS, { message: 'Choose how the customer paid.' })
  method!: PaymentMethod;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(60, { message: 'The reference is too long (60 characters at most).' })
  referenceNo?: string | null;
}

export class ListSalesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(SALE_PAYMENT_STATUSES)
  paymentStatus?: SalePaymentStatus;

  /** true = sales that still have something to pay (pending or partial) */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unpaid?: boolean;

  @IsOptional()
  @IsIn(SALE_STATUSES)
  status?: SaleStatus;

  @IsOptional()
  @IsUUID('all')
  salespersonId?: string;

  /** owner only */
  @IsOptional()
  @IsUUID('all')
  locationId?: string;

  @IsOptional()
  @Matches(DAY, { message: 'Use the format YYYY-MM-DD.' })
  from?: string;

  @IsOptional()
  @Matches(DAY, { message: 'Use the format YYYY-MM-DD.' })
  to?: string;
}
