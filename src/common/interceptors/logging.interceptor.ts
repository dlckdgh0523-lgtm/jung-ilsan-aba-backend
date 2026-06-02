import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.write(req, http.getResponse<Response>().statusCode, started),
        error: () => this.write(req, http.getResponse<Response>().statusCode, started),
      }),
    );
  }

  private write(req: Request, status: number, started: number): void {
    this.logger.log(`${req.method} ${req.originalUrl} ${status} ${Date.now() - started}ms`);
  }
}
