import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { ROLES, type Role } from '../../common/types/roles';
import { trim, trimToNull } from '../../common/utils/transforms';

const lowerTrim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class UpdateUserDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Enter a name.' })
  @Length(2, 100, { message: 'The name must be between 2 and 100 characters.' })
  fullName?: string;

  @IsOptional()
  @Transform(lowerTrim)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254, { message: 'That email address is too long.' })
  email?: string;

  @IsOptional()
  @Transform(trimToNull)
  @Matches(/^[+\d][\d\s-]{5,19}$/, { message: 'Enter a valid phone number, for example +251 911 000000.' })
  phone?: string | null;

  @IsOptional()
  @IsIn(ROLES, { message: 'Choose a role.' })
  role?: Role;

  @IsOptional()
  @Transform(trimToNull)
  @IsUUID('all', { message: 'Choose a location from the list.' })
  locationId?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @Matches(/^-?\d{5,20}$/, { message: 'A Telegram chat id is a number.' })
  telegramChatId?: string | null;
}
