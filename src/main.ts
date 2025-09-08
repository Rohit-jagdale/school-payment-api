import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS with specific configuration
  app.enableCors({
    origin: [
      'http://localhost:5173', // Vite dev server
      'http://localhost:3000', // Alternative dev server
      'http://127.0.0.1:5173', // Alternative localhost
      'http://127.0.0.1:3000', // Alternative localhost
      'https://school-payment-frontend-epmi.vercel.app',// Add your production frontend URL here when deployed
      'https://school-payment-frontend-epmi-18glznvl6-rohits-projects-e6c08023.vercel.app',// Add your production frontend URL here when deployed
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });
  
  // Enable validation pipes globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port: ${port}`);
}
bootstrap();