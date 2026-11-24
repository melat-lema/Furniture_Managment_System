import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PAYMENT_METHODS, VERIFICATION_STATUSES, type PaymentMethod, type VerificationStatus } from '../../common/types/sales';
import { toBoolean, trimToUndefined } from '../../common/utils/transforms';

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(VERIFICATION_STATUSES)
  status?: VerificationStatus;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod;

  /** true = waiting longer than the reminder time */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  overdue?: boolean;

  /** owner only */
  @IsOptional()
  @IsUUID('all')
  locationId?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(60)
  search?: string;
}

export class RejectPaymentDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Please tell the showroom why the payment is rejected.' })
  @MinLength(3, { message: 'Please tell the showroom why the payment is rejected.' })
  @MaxLength(200, { message: 'The reason is too long (200 characters at most).' })
  reason!: string;
}

export class BulkVerifyDto {
  @IsArray({ message: 'Choose at least one payment.' })
  @ArrayMinSize(1, { message: 'Choose at least one payment.' })
  @ArrayMaxSize(50, { message: 'You can verify up to 50 payments at a time.' })
  @IsUUID('all', { each: true, message: 'One of the payments is not valid.' })
  ids!: string[];
}
