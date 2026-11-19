import { Module } from '@nestjs/common';
import { SalespeopleController } from './salespeople.controller';
import { SalespeopleService } from './salespeople.service';

@Module({
  controllers: [SalespeopleController],
  providers: [SalespeopleService],
})
export class SalespeopleModule {}
