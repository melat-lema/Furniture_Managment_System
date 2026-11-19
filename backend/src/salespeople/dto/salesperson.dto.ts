import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { toBoolean, trim, trimToNull } from '../../common/utils/transforms';

const PHONE = /^[+\d][\d\s-]{5,19}$/;

export class CreateSalespersonDto {
  @Transform(trim)
  @IsString({ message: 'Enter the name.' })
  @Length(2, 80, { message: 'The name must be between 2 and 80 characters.' })
  fullName!: string;

  @IsOptional()
  @Transform(trimToNull)
  @Matches(PHONE, { message: 'Enter a valid phone number, for example +251 911 000000.' })
  phone?: string | null;

  /** Only the owner sends this (a showroom account always uses its own showroom). */
  @IsOptional()
  @IsUUID('all', { message: 'Choose a showroom.' })
  showroomId?: string;
}

export class UpdateSalespersonDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Enter the name.' })
  @Length(2, 80, { message: 'The name must be between 2 and 80 characters.' })
  fullName?: string;

  @IsOptional()
  @Transform(trimToNull)
  @Matches(PHONE, { message: 'Enter a valid phone number, for example +251 911 000000.' })
  phone?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be true or false.' })
  isActive?: boolean;
}

export class ListSalespeopleQueryDto {
  @IsOptional()
  @IsUUID('all')
  showroomId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeInactive?: boolean;
}
