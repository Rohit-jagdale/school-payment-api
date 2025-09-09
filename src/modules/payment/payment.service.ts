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
      const customOrderId = createPaymentDto.custom_order_id || `ORDER_${Date.now()}_${uuidv4().substring(0, 8)}`;

      const order = new this.orderModel({
        school_id: createPaymentDto.school_id,
        trustee_id: createPaymentDto.trustee_id,
        student_info: createPaymentDto.student_info,
        gateway_name: createPaymentDto.gateway_name,
        custom_order_id: customOrderId
      });

      const savedOrder = await order.save();

      const orderStatus = new this.orderStatusModel({
        collect_id: savedOrder._id,
        order_amount: createPaymentDto.order_amount,
        transaction_amount: createPaymentDto.order_amount,
        payment_mode: 'pending',
        payment_details: 'Payment initiated',
        bank_reference: 'N/A',
        payment_message: 'Payment initiated',
        status: 'Pending',
        error_message: 'NA'
      });

      await orderStatus.save();

      const callbackUrl = `${this.configService.get('BASE_URL') || 'http://localhost:3000'}/payment/callback`;
      
      const jwtPayload = {
        school_id: createPaymentDto.school_id,
        amount: createPaymentDto.order_amount.toString(),
        callback_url: callbackUrl
      };

      const sign = jwt.sign(jwtPayload, this.configService.get('PG_KEY'), {
        expiresIn: '1h'
      });

      const paymentPayload = {
        school_id: createPaymentDto.school_id,
        amount: createPaymentDto.order_amount.toString(),
        callback_url: callbackUrl,
        sign: sign
      };

      const paymentResponse = await this.callPaymentGateway(paymentPayload);

      await this.orderModel.findByIdAndUpdate(savedOrder._id, {
        collect_request_id: paymentResponse.collect_request_id
      });

      return {
        success: true,
        order_id: customOrderId,
        collect_request_id: paymentResponse.collect_request_id,
        payment_url: paymentResponse.collect_request_url || `https://dev-vanilla.edviron.com/payment/${paymentResponse.collect_request_id}`,
        message: 'Payment initiated successfully'
      };

    } catch (error) {
      throw new BadRequestException(`Payment creation failed: ${error.message}`);
    }
  }

  async callPaymentGateway(payload: any) {
    try {
      const response = await axios.post(
        'https://dev-vanilla.edviron.com/erp/create-collect-request',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.configService.get('API_KEY')}`,
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

    
      if (order.collect_request_id) {
        const jwtPayload = {
          school_id: order.school_id.toString(),
          collect_request_id: order.collect_request_id
        };

        const sign = jwt.sign(jwtPayload, this.configService.get('PG_KEY'), {
          expiresIn: '1h'
        });

        const statusResponse = await this.checkPaymentStatusWithGateway(
          order.collect_request_id,
          order.school_id.toString(),
          sign
        );

        const updateData: any = {
          payment_time: new Date()
        };

        if (statusResponse.status === 'SUCCESS') {
          updateData.status = 'Success';
        } else if (statusResponse.status === 'FAILED') {
          updateData.status = 'Failed';
        } else if (statusResponse.status === 'PENDING') {
          updateData.status = 'Pending';
        } else {
          updateData.status = 'Pending';
        }

        if (statusResponse.details) {
          updateData.payment_mode = statusResponse.details.payment_mode || 'unknown';
          updateData.bank_reference = statusResponse.details.bank_ref || 'N/A';
          
          let paymentMessage = `Payment ${updateData.status}`;
          if (statusResponse.details.payment_methods?.card) {
            const card = statusResponse.details.payment_methods.card;
            paymentMessage = `Payment via ${card.card_type} (${card.card_network}) - ${card.card_bank_name}`;
          }
          updateData.payment_message = paymentMessage;
          
          let paymentDetails = `Payment ${updateData.status}`;
          if (statusResponse.details.payment_methods?.card) {
            const card = statusResponse.details.payment_methods.card;
            paymentDetails = `Card ending in ${card.card_number.slice(-4)} - ${card.card_bank_name}`;
          }
          updateData.payment_details = paymentDetails;
        }

        await this.orderStatusModel.findOneAndUpdate(
          { collect_id: order._id },
          updateData
        );

        return {
          order_id: customOrderId,
          collect_request_id: order.collect_request_id,
          status: statusResponse.status,
          amount: statusResponse.amount,
          details: statusResponse.details,
          jwt: statusResponse.jwt
        };
      }

      const orderStatus = await this.orderStatusModel.findOne({ collect_id: order._id });
      
      return {
        order_id: customOrderId,
        status: orderStatus?.status || 'Pending',
        payment_details: orderStatus?.payment_details || 'N/A',
        payment_time: orderStatus?.payment_time || null
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get payment status: ${error.message}`);
    }
  }

  async checkPaymentStatusWithGateway(collectRequestId: string, schoolId: string, sign: string) {
    try {
      const response = await axios.get(
        `https://dev-vanilla.edviron.com/erp/collect-request/${collectRequestId}`,
        {
          params: {
            school_id: schoolId,
            sign: sign
          },
          headers: {
            'Authorization': `Bearer ${this.configService.get('API_KEY')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw new BadRequestException(`Payment status check failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async handlePaymentCallback(query: any) {
    try {
      console.log('Payment callback received:', query);
      
      return {
        success: true,
        message: 'Callback received successfully'
      };
    } catch (error) {
      throw new BadRequestException(`Callback handling failed: ${error.message}`);
    }
  }
}
