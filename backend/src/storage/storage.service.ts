import { randomUUID } from 'node:crypto';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ErrorCode } from '../common/constants';
import type { DetectedImage } from './image-type';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly client: SupabaseClient | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL')?.trim();
    const key = config.get<string>('SUPABASE_SECRET_KEY')?.trim();
    this.bucket = config.get<string>('SUPABASE_PRODUCT_BUCKET')?.trim() || 'product-images';
    this.client =
      url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

    if (!this.client) {
      this.logger.warn('SUPABASE_URL or SUPABASE_SECRET_KEY is not set: product image uploads are disabled.');
    }
  }

  /** Public address of a stored image (the product-images bucket is public), or null. */
  publicUrl(path: string | null): string | null {
    if (!path || !this.client) return null;
    return this.client.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }

  async uploadProductImage(productId: string, buffer: Buffer, type: DetectedImage): Promise<string> {
    const client = this.requireClient();
    const path = `products/${productId}/${randomUUID()}.${type.ext}`;

    const { error } = await client.storage.from(this.bucket).upload(path, buffer, {
      contentType: type.mime,
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) {
      this.logger.error(`Image upload failed: ${error.message}`);
      throw new HttpException(
        { code: ErrorCode.STORAGE_ERROR, message: 'We could not save the image right now. Please try again.' },
        HttpStatus.BAD_GATEWAY,
      );
    }
    return path;
  }

  /** Best effort: a leftover file is harmless, so a failure here is logged but never shown to the user. */
  async deleteProductImage(path: string): Promise<void> {
    if (!this.client) return;
    try {
      const { error } = await this.client.storage.from(this.bucket).remove([path]);
      if (error) this.logger.warn(`Could not delete ${path}: ${error.message}`);
    } catch (error) {
      this.logger.warn(`Could not delete ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new HttpException(
        {
          code: ErrorCode.STORAGE_UNAVAILABLE,
          message: 'Image storage is not set up yet. Ask the administrator to configure it.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.client;
  }
}
