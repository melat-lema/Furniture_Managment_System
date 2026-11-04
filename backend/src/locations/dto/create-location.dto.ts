import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { LOCATION_TYPES, type LocationType } from '../../common/types/roles';
import { trim, trimToNull } from '../../common/utils/transforms';

export class CreateLocationDto {
  @Transform(trim)
  @IsString({ message: 'Enter a name.' })
  @Length(2, 80, { message: 'The name must be between 2 and 80 characters.' })
  name!: string;

  @IsIn(LOCATION_TYPES, { message: 'Choose workshop, store or showroom.' })
  type!: LocationType;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(200, { message: 'The address is too long.' })
  address?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(40, { message: 'The phone number is too long.' })
  phone?: string | null;
}
