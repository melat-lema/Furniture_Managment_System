import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SALES_ROLES } from '../common/permissions';
import type { AuthUser } from '../common/types/auth-user';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

function sendCsv(res: Response, file: { filename: string; body: string }): string {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  return file.body;
}

/** The owner sees every showroom; a showroom sees only itself. */
@Roles(...SALES_ROLES)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** GET /api/reports/sales?from=2026-11-01&to=2026-11-30&locationId=&salespersonId= */
  @Get('sales')
  sales(@Query() query: ReportQueryDto, @CurrentUser() user: AuthUser) {
    return this.reports.sales(query, user);
  }

  /** GET /api/reports/sales/export  (a CSV file of the sales) */
  @Get('sales/export')
  async exportSales(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendCsv(res, await this.reports.salesCsv(query, user, req.ip ?? null));
  }

  /** GET /api/reports/payments/export  (a CSV file of the payments recorded in the period) */
  @Get('payments/export')
  async exportPayments(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendCsv(res, await this.reports.paymentsCsv(query, user, req.ip ?? null));
  }
}
