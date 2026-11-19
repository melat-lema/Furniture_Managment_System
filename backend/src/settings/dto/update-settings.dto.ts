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
}
