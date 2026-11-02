import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'Enter your current password.' })
  @MinLength(1, { message: 'Enter your current password.' })
  @MaxLength(128, { message: 'That password is too long.' })
  currentPassword!: string;

  @IsString({ message: 'Enter a new password.' })
  @MinLength(10, { message: 'Use at least 10 characters.' })
  @MaxLength(128, { message: 'That password is too long.' })
  @Matches(/[A-Za-z]/, { message: 'Include at least one letter.' })
  @Matches(/\d/, { message: 'Include at least one number.' })
  newPassword!: string;
}
