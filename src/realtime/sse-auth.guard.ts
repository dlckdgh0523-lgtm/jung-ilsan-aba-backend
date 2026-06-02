import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AppException } from '../common/exceptions/app.exception';
import { extractBearerToken } from '../auth/guards/extract-token';
import type { RequestWithUser } from '../auth/interfaces/auth-user.interface';

/**
 * Authenticates SSE streams. EventSource cannot send an Authorization header,
 * so the admin token is passed as `?token=…`; a Bearer header is still accepted
 * for non-browser clients.
 */
@Injectable()
export class SseAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(req);
    if (!token) throw AppException.unauthorized('인증이 필요합니다.');
    req.user = await this.auth.verifyToken(token);
    return true;
  }

  private extractToken(req: RequestWithUser): string | null {
    const fromQuery = req.query?.token;
    if (typeof fromQuery === 'string' && fromQuery) return fromQuery.trim();
    return extractBearerToken(req);
  }
}
