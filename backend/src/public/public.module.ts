import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { ChatbotService } from './chatbot.service';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [StorageModule],
  controllers: [PublicController],
  providers: [PublicService, ChatbotService],
})
export class PublicModule {}
