import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pageArgs } from '../common/utils/pagination';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { PublicProductsQueryDto } from './dto/public.dto';

/** Only products the owner switched on for the website, and that are still active. */
export const PUBLISHED = { isPublished: true, isActive: true } satisfies Prisma.ProductWhereInput;

export const CARD_SELECT = {
  id: true,
  name: true,
  description: true,
  material: true,
  dimensions: true,
  price: true,
  imagePath: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;
type CardRow = Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>;

export interface ProductCard {
  id: string;
  name: string;
  category: string;
  description: string | null;
  material: string | null;
  dimensions: string | null;
  /** null when the owner chose not to show prices publicly */
  price: number | null;
  imageUrl: string | null;
}

export interface ShowroomCard {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

export interface ContactInfo {
  phone: string | null;
  whatsapp: string | null;
  hours: string | null;
}

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /** PUBLIC_SHOW_PRICES=false hides every price from the website and the chatbot. */
  showPrices(): boolean {
    return (this.config.get<string>('PUBLIC_SHOW_PRICES') ?? 'true').trim().toLowerCase() !== 'false';
  }

  contact(): ContactInfo {
    const clean = (value: string | undefined): string | null => (value && value.trim() !== '' ? value.trim() : null);
    const whatsapp = clean(this.config.get<string>('SITE_WHATSAPP'))?.replace(/\D/g, '') ?? null;
    return {
      phone: clean(this.config.get<string>('SITE_PHONE')),
      whatsapp: whatsapp && whatsapp.length >= 8 ? whatsapp : null,
      hours: clean(this.config.get<string>('SITE_OPENING_HOURS')),
    };
  }

  card(row: CardRow): ProductCard {
    return {
      id: row.id,
      name: row.name,
      category: row.category.name,
      description: row.description,
      material: row.material,
      dimensions: row.dimensions,
      price: this.showPrices() ? Number(row.price.toString()) : null,
      imageUrl: this.storage.publicUrl(row.imagePath),
    };
  }

  async showrooms(): Promise<ShowroomCard[]> {
    return this.prisma.location.findMany({
      where: { type: 'SHOWROOM', isActive: true },
      select: { id: true, name: true, address: true, phone: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Categories that have at least one published product, with a picture from the newest one. */
  async categories() {
    const [categories, pictures] = await Promise.all([
      this.prisma.category.findMany({
        select: { id: true, name: true, _count: { select: { products: { where: PUBLISHED } } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { ...PUBLISHED, imagePath: { not: null } },
        distinct: ['categoryId'],
        orderBy: { createdAt: 'desc' },
        select: { categoryId: true, imagePath: true },
      }),
    ]);
    const pictureOf = new Map(pictures.map((row) => [row.categoryId, row.imagePath]));
    return categories
      .filter((category) => category._count.products > 0)
      .map((category) => ({
        id: category.id,
        name: category.name,
        count: category._count.products,
        imageUrl: this.storage.publicUrl(pictureOf.get(category.id) ?? null),
      }));
  }

  /** Everything the home page needs, in one request. */
  async site() {
    const [productCount, categories, showrooms, featured] = await Promise.all([
      this.prisma.product.count({ where: PUBLISHED }),
      this.categories(),
      this.showrooms(),
      this.prisma.product.findMany({
        where: { ...PUBLISHED, imagePath: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: CARD_SELECT,
      }),
    ]);
    return {
      stats: { products: productCount, categories: categories.length, showrooms: showrooms.length },
      categories,
      featured: featured.map((row) => this.card(row)),
      showrooms,
      contact: this.contact(),
      showPrices: this.showPrices(),
    };
  }

  async products(query: PublicProductsQueryDto) {
    const search = query.search;
    const where: Prisma.ProductWhereInput = {
      ...PUBLISHED,
      ...(query.category && { categoryId: query.category }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { material: { contains: search, mode: 'insensitive' } },
          { category: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };
    const pageSize = Math.min(query.pageSize, 24);
    const sort = this.showPrices() ? query.sort : undefined;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: CARD_SELECT,
        orderBy: sort === 'price_asc' ? { price: 'asc' } : sort === 'price_desc' ? { price: 'desc' } : { createdAt: 'desc' },
        ...pageArgs({ page: query.page, pageSize }),
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items: rows.map((row) => this.card(row)), total, page: query.page, pageSize };
  }
}
