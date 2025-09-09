import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS - allow specific frontend origins
  app.enableCors({
    origin: [
      'https://school-payment-frontend-six.vercel.app',
      'https://school-payment-frontend-git-main-rohits-projects-e6c08023.vercel.app',
      'https://school-payment-frontend-ec765y7rz-rohits-projects-e6c08023.vercel.app',
      'http://localhost:3000', // For local development
      'http://localhost:5173', // For Vite dev server
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200, // For legacy browser support
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