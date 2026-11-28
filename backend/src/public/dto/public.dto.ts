import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { trimToUndefined } from '../../common/utils/transforms';

export class PublicProductsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('all')
  category?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsIn(['new', 'price_asc', 'price_desc'])
  sort?: 'new' | 'price_asc' | 'price_desc';
}

export class ChatDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Please type a message.' })
  @MinLength(1, { message: 'Please type a message.' })
  @MaxLength(500, { message: 'That message is too long (500 characters at most).' })
  message!: string;
}
