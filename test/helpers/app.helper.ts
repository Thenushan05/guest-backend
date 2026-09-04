/**
 * E2E Test Application Helper
 *
 * Boots a full NestJS application (identical to production bootstrap in main.ts)
 * backed by the DATABASE_URL from the .env.test file.
 *
 * ThrottlerGuard is replaced with a no-op so rapid sequential requests in the
 * test suite are never rate-limited. Rate limiting is a concern for load/smoke
 * tests, not integration tests.
 *
 * Usage:
 *   const { app, prefix } = await createTestApp();
 *   // ...tests...
 *   await closeTestApp(app);
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import cookieParser from 'cookie-parser';

export const API_PREFIX = 'api/v1';

/** A no-op guard that replaces ThrottlerGuard in tests. */
class NoopThrottlerGuard extends ThrottlerGuard {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async canActivate(_context: unknown): Promise<boolean> {
    return true;
  }
}

/**
 * Boot the full application with all global guards, pipes, filters, and
 * interceptors active — identical to production — except rate limiting is
 * disabled so tests never get throttled by rapid sequential requests.
 */
export async function createTestApp(): Promise<{ app: INestApplication; prefix: string }> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ThrottlerGuard)
    .useClass(NoopThrottlerGuard)
    .compile();

  const app = moduleRef.createNestApplication();

  app.setGlobalPrefix(API_PREFIX);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();

  return { app, prefix: `/${API_PREFIX}` };
}

/** Close the app and release database connections. */
export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
}

