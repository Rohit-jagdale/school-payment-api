import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      message: 'Welcome to School Payment API',
      version: '1.0.0',
      endpoints: {
        auth: '/auth',
        payment: '/payment',
        transactions: '/transactions',
        webhook: '/webhook'
      }
    };
  }
}
