import { HttpException, HttpStatus } from '@nestjs/common';

export type FieldErrors = Record<string, string>;

/**
 * Domain exception carrying the spec error envelope `{ code, message, fields? }`.
 * The global AllExceptionsFilter reads this payload directly.
 */
export class AppException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, fields?: FieldErrors) {
    super({ code, message, ...(fields ? { fields } : {}) }, status);
  }

  static badRequest(
    message = 'Bad request',
    code = 'BAD_REQUEST',
    fields?: FieldErrors,
  ): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, code, message, fields);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED'): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, code, message);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN'): AppException {
    return new AppException(HttpStatus.FORBIDDEN, code, message);
  }

  static notFound(message = 'Not found', code = 'NOT_FOUND'): AppException {
    return new AppException(HttpStatus.NOT_FOUND, code, message);
  }

  static conflict(message = 'Conflict', code = 'CONFLICT'): AppException {
    return new AppException(HttpStatus.CONFLICT, code, message);
  }

  static unprocessable(
    message = 'Unprocessable entity',
    code = 'VALIDATION',
    fields?: FieldErrors,
  ): AppException {
    return new AppException(HttpStatus.UNPROCESSABLE_ENTITY, code, message, fields);
  }
}
