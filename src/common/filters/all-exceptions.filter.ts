import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // SSE / already-sent responses: nothing we can do with JSON.
    if (res.headersSent) {
      this.logger.warn(`${req.method} ${req.originalUrl} threw after headers sent`);
      return;
    }

    const { status, body } = this.normalize(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${req.method} ${req.originalUrl} -> ${status} ${body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${req.method} ${req.originalUrl} -> ${status} ${body.code}: ${body.message}`,
      );
    }

    res.status(status).json({ error: body });
  }

  private normalize(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      return this.fromHttp(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception);
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: { code: 'BAD_REQUEST', message: 'Invalid query' },
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL', message: 'Internal server error' },
    };
  }

  private fromHttp(exception: HttpException): { status: number; body: ErrorBody } {
    const status = exception.getStatus();
    const resp = exception.getResponse();

    if (typeof resp === 'object' && resp !== null) {
      const r = resp as Record<string, unknown>;
      const rawMessage = r.message ?? exception.message;
      const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : String(rawMessage);
      return {
        status,
        body: {
          code: typeof r.code === 'string' ? r.code : this.codeForStatus(status),
          message,
          ...(r.fields ? { fields: r.fields as Record<string, string> } : {}),
        },
      };
    }

    return {
      status,
      body: {
        code: this.codeForStatus(status),
        message: typeof resp === 'string' ? resp : exception.message,
      },
    };
  }

  private fromPrisma(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    body: ErrorBody;
  } {
    switch (exception.code) {
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: { code: 'NOT_FOUND', message: 'Resource not found' },
        };
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          body: { code: 'CONFLICT', message: 'Unique constraint violation' },
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          body: { code: 'CONFLICT', message: 'Related record constraint' },
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          body: { code: 'BAD_REQUEST', message: `Database error (${exception.code})` },
        };
    }
  }

  private codeForStatus(status: number): string {
    const map: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION',
      [HttpStatus.PAYLOAD_TOO_LARGE]: 'FILE_TOO_LARGE',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
    };
    return map[status] ?? 'ERROR';
  }
}
