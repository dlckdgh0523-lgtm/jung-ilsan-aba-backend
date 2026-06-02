import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/** Require a valid admin JWT. Shorthand for `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('admin')`. */
export const AdminOnly = (): ReturnType<typeof applyDecorators> =>
  applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles('admin'));
