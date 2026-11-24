import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Enter a whole number.' })
  @Min(0, { message: 'The limit cannot be negative.' })
  @Max(1000, { message: 'That limit is too high.' })
  low_stock_threshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Enter a whole number between 0 and 100.' })
  @Min(0, { message: 'The discount limit cannot be negative.' })
  @Max(100, { message: 'The discount limit cannot be more than 100%.' })
  max_discount_percent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Enter a whole number of hours.' })
  @Min(1, { message: 'Use at least 1 hour.' })
  @Max(720, { message: 'Use 720 hours (30 days) at most.' })
  payment_reminder_hours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Enter a whole number of hours.' })
  @Min(1, { message: 'Use at least 1 hour.' })
  @Max(720, { message: 'Use 720 hours (30 days) at most.' })
  payment_escalation_hours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Enter a whole number of hours.' })
  @Min(0, { message: 'Use 0 or more hours.' })
  @Max(720, { message: 'Use 720 hours (30 days) at most.' })
  sale_void_window_hours?: number;
}
