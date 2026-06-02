import { HttpStatus, Logger, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { mkdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { AppException } from './common/exceptions/app.exception';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

function flattenValidationErrors(errors: ValidationError[], prefix = ''): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const err of errors) {
    const key = prefix ? `${prefix}.${err.property}` : err.property;
    if (err.constraints) {
      fields[key] = Object.values(err.constraints).join(', ');
    }
    if (err.children?.length) {
      Object.assign(fields, flattenValidationErrors(err.children, key));
    }
  }
  return fields;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<AppConfig, true>);

  const env = config.get('env', { infer: true });
  const port = config.get('port', { infer: true });
  const apiPrefix = config.get('apiPrefix', { infer: true });
  const corsOrigins = config.get('corsOrigins', { infer: true });
  const upload = config.get('upload', { infer: true });

  app.set('trust proxy', 1); // behind Nginx — honour X-Forwarded-* for client IP / protocol
  app.setGlobalPrefix(apiPrefix);

  app.use(
    helmet({
      // Images/uploads are served cross-origin to the SPA; relax CORP, drop CSP (SPA serves its own).
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  if (env === 'production' && corsOrigins.length === 0) {
    Logger.warn('CORS_ORIGINS is empty in production — all origins are allowed.', 'Bootstrap');
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) =>
        new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'VALIDATION',
          'Validation failed',
          flattenValidationErrors(errors),
        ),
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.enableShutdownHooks();

  const uploadDir = isAbsolute(upload.dir) ? upload.dir : resolve(process.cwd(), upload.dir);
  mkdirSync(uploadDir, { recursive: true });
  // Serve stored uploads at the public base (e.g. /uploads/*), outside the API prefix.
  app.useStaticAssets(uploadDir, { prefix: upload.publicBase });

  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on http://0.0.0.0:${port}/${apiPrefix} (env=${env})`, 'Bootstrap');
}

void bootstrap();
