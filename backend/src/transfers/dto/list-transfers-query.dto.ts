import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { TRANSFER_STATUSES, type TransferStatus } from '../../common/types/transfer';
import { trimToUndefined } from '../../common/utils/transforms';

export class ListTransfersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(TRANSFER_STATUSES)
  status?: TransferStatus;

  /** relative to the signed-in user's own location */
  @IsOptional()
  @IsIn(['incoming', 'outgoing'])
  direction?: 'incoming' | 'outgoing';

  /** owner and workshop manager only */
  @IsOptional()
  @IsUUID('all')
  locationId?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(40)
  search?: string;
}
