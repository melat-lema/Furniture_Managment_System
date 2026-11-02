import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as open to everyone (no login needed). Everything else requires login. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
