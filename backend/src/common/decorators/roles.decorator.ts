import { SetMetadata } from '@nestjs/common';
import type { Role } from '../types/roles';

export const ROLES_KEY = 'roles';
/** Example: @Roles('OWNER', 'STORE_MANAGER'). Without it, any logged-in user may call the route. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
