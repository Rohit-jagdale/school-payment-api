import { Controller, Post, Get, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { CreatePaymentDto } from '../../dto/create-payment.dto';

@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-payment')
  async createPayment(@Body() createPaymentDto: CreatePaymentDto, @Request() req) {
    return await this.paymentService.createPayment(createPaymentDto, req.user);
  }

  @Get('status/:customOrderId')
  async getPaymentStatus(@Param('customOrderId') customOrderId: string) {
    return await this.paymentService.getPaymentStatus(customOrderId);
  }

  @Get('callback')
  async paymentCallback(@Query() query: any) {
    return await this.paymentService.handlePaymentCallback(query);
  }
}
