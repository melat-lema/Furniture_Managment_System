import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { StockModule } from '../stock/stock.module';
import { StorageModule } from '../storage/storage.module';
import { PaymentsController } from './payments.controller';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [StockModule, StorageModule, SettingsModule],
  controllers: [SalesController, PaymentsController],
  providers: [SalesService],
})
export class SalesModule {}
