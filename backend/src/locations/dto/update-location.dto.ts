import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { trim, trimToNull } from '../../common/utils/transforms';

/** The type of a location cannot be changed after it is created (users and stock depend on it). */
export class UpdateLocationDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Enter a name.' })
  @Length(2, 80, { message: 'The name must be between 2 and 80 characters.' })
  name?: string;

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

  @IsOptional()
  @IsBoolean({ message: 'isActive must be true or false.' })
  isActive?: boolean;
}
