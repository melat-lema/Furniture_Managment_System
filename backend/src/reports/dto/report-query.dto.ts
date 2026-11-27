import { IsOptional, IsUUID, Matches } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ReportQueryDto {
  /** first day, YYYY-MM-DD (default: the 1st of this month) */
  @IsOptional()
  @Matches(DAY, { message: 'Use the format YYYY-MM-DD.' })
  from?: string;

  /** last day, YYYY-MM-DD (default: today) */
  @IsOptional()
  @Matches(DAY, { message: 'Use the format YYYY-MM-DD.' })
  to?: string;

  /** owner only: one showroom */
  @IsOptional()
  @IsUUID('all')
  locationId?: string;

  @IsOptional()
  @IsUUID('all')
  salespersonId?: string;
}
