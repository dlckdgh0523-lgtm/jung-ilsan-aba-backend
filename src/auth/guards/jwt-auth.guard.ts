import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { AppException } from '../../common/exceptions/app.exception';
import { extractBearerToken } from './extract-token';
import type { RequestWithUser } from '../interfaces/auth-user.interface';

/** Requires a valid Bearer token; attaches the AuthUser to the request. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(req);
    if (!token) throw AppException.unauthorized('인증이 필요합니다.');
    req.user = await this.auth.verifyToken(token);
    return true;
  }
}
