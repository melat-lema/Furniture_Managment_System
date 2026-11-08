import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { StorageModule } from '../storage/storage.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [StockModule, StorageModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
