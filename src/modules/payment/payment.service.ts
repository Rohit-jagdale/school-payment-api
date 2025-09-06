import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderDocument } from '../../schemas/order.schema';
import { OrderStatus, OrderStatusDocument } from '../../schemas/order-status.schema';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(OrderStatus.name) private orderStatusModel: Model<OrderStatusDocument>,
    private configService: ConfigService
  ) {}

  async createPayment(createPaymentDto: any, user: any) {
    try {
      // Generate custom order ID if not provided
      const customOrderId = createPaymentDto.custom_order_id || `ORDER_${Date.now()}_${uuidv4().substring(0, 8)}`;

      // Create order in database
      const order = new this.orderModel({
        school_id: createPaymentDto.school_id,
        trustee_id: createPaymentDto.trustee_id,
        student_info: createPaymentDto.student_info,
        gateway_name: createPaymentDto.gateway_name,
        custom_order_id: customOrderId
      });

      const savedOrder = await order.save();

      // Create order status entry
      const orderStatus = new this.orderStatusModel({
        collect_id: savedOrder._id,
        order_amount: createPaymentDto.order_amount,
        transaction_amount: createPaymentDto.order_amount,
        payment_mode: 'pending',
        payment_details: 'Payment initiated',
        bank_reference: 'N/A',
        payment_message: 'Payment initiated',
        status: 'pending',
        error_message: 'NA'
      });

      await orderStatus.save();

      // Prepare payment gateway payload
      const paymentPayload = {
        pg_key: this.configService.get('PG_KEY'),
        school_id: this.configService.get('SCHOOL_ID'),
        order_id: customOrderId,
        order_amount: createPaymentDto.order_amount,
        student_info: createPaymentDto.student_info,
        gateway_name: createPaymentDto.gateway_name
      };

      // Generate JWT token for payment API
      const jwtToken = jwt.sign(paymentPayload, this.configService.get('API_KEY'), {
        expiresIn: '1h'
      });

      // Call payment gateway API
      const paymentResponse = await this.callPaymentGateway(jwtToken, paymentPayload);

      return {
        success: true,
        order_id: customOrderId,
        payment_url: paymentResponse.payment_url,
        message: 'Payment initiated successfully'
      };

    } catch (error) {
      throw new BadRequestException(`Payment creation failed: ${error.message}`);
    }
  }

  async callPaymentGateway(jwtToken: string, payload: any) {
    try {
      const response = await axios.post(
        `${this.configService.get('PAYMENT_API_URL')}/create-collect-request`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw new BadRequestException(`Payment gateway error: ${error.response?.data?.message || error.message}`);
    }
  }

  async getPaymentStatus(customOrderId: string) {
    try {
      const order = await this.orderModel.findOne({ custom_order_id: customOrderId });
      if (!order) {
        throw new BadRequestException('Order not found');
      }

      const orderStatus = await this.orderStatusModel.findOne({ collect_id: order._id });
      
      return {
        order_id: customOrderId,
        status: orderStatus?.status || 'pending',
        payment_details: orderStatus?.payment_details || 'N/A',
        payment_time: orderStatus?.payment_time || null
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get payment status: ${error.message}`);
    }
  }
}
