import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppException } from '../../common/exceptions/app.exception';
import type { RequestWithUser } from '../interfaces/auth-user.interface';

/** Enforces @Roles(...) metadata. Runs after JwtAuthGuard, which populates req.user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = ctx.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user) throw AppException.unauthorized('인증이 필요합니다.');
    if (!required.includes(user.role)) throw AppException.forbidden('권한이 없습니다.');
    return true;
  }
}
