import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const configService = app.get(ConfigService);

  const apiPrefix = configService.get<string>('apiPrefix', 'api/v1');
  const frontendUrl = configService.get<string>('frontendUrl', 'http://localhost:3001');
  const isProduction = configService.get<string>('nodeEnv') === 'production';

  app.setGlobalPrefix(apiPrefix);

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: frontendUrl.split(',').map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Guest House Management System API')
      .setDescription(
        'REST API for the Guest House Management System - room, booking, offer and availability management for admins and customers.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('Auth')
      .addTag('Rooms')
      .addTag('Room Types')
      .addTag('Facilities')
      .addTag('Availability')
      .addTag('Bookings')
      .addTag('Offers')
      .addTag('Admin - Users')
      .addTag('Admin - Bookings')
      .addTag('Admin - Offers')
      .addTag('Admin - Dashboard')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = configService.get<number>('port', 3000);
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`🏨 Guest House API running on http://localhost:${port}/${apiPrefix}`);
  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.log(`📚 Swagger docs available at http://localhost:${port}/api/docs`);
  }
}

bootstrap();
