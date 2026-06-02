import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { extractBearerToken } from './extract-token';
import type { RequestWithUser } from '../interfaces/auth-user.interface';

/**
 * Attaches req.user when a valid Bearer token is present, otherwise proceeds
 * anonymously. Lets public list endpoints elevate to admin visibility (see
 * trashed/visible query params) without forcing auth.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(req);
    if (!token) return true;
    try {
      req.user = await this.auth.verifyToken(token);
    } catch {
      // Stale/invalid token on a public route → fall back to anonymous.
    }
    return true;
  }
}
