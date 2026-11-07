import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { StockController } from './stock.controller';
import { StockLedgerService } from './stock-ledger.service';
import { StockService } from './stock.service';

@Module({
  imports: [StorageModule],
  controllers: [StockController],
  providers: [StockService, StockLedgerService],
  // Transfers and sales (next weeks) use the same ledger service.
  exports: [StockLedgerService],
})
export class StockModule {}
