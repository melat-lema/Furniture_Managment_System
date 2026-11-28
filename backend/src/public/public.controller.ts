import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ChatbotService } from './chatbot.service';
import { ChatDto, PublicProductsQueryDto } from './dto/public.dto';
import { PublicService } from './public.service';

/**
 * Everything the public website may ask for. No login. Only products the owner switched on for the website
 * are ever returned, and never any stock numbers, costs or customer data.
 */
@Public()
@Controller('public')
export class PublicController {
  constructor(
    private readonly site: PublicService,
    private readonly chatbot: ChatbotService,
  ) {}

  /** GET /api/public/site  (categories, featured pieces, showrooms, counts) */
  @Get('site')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'public, max-age=60')
  getSite() {
    return this.site.site();
  }

  /** GET /api/public/products?category=&search=&sort=&page=&pageSize= */
  @Get('products')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'public, max-age=30')
  products(@Query() query: PublicProductsQueryDto) {
    return this.site.products(query);
  }

  /** POST /api/public/chat  { message }  (the website chatbot; strictly rate limited) */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  chat(@Body() dto: ChatDto) {
    return this.chatbot.reply(dto.message);
  }
}
