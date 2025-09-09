import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../../schemas/order.schema';
import { OrderStatus, OrderStatusDocument } from '../../schemas/order-status.schema';
import { WebhookLogs, WebhookLogsDocument } from '../../schemas/webhook-logs.schema';

@Injectable()
export class WebhookService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(OrderStatus.name) private orderStatusModel: Model<OrderStatusDocument>,
    @InjectModel(WebhookLogs.name) private webhookLogsModel: Model<WebhookLogsDocument>
  ) {}

  async processWebhook(webhookData: any) {
    try {
      
      const webhookLog = new this.webhookLogsModel({
        order_id: webhookData.order_info.order_id,
        webhook_payload: webhookData,
        status: 'received'
      });

      await webhookLog.save();

      
      const order = await this.orderModel.findOne({ 
        custom_order_id: webhookData.order_info.order_id 
      });

      if (!order) {
        webhookLog.status = 'failed';
        webhookLog.error_message = 'Order not found';
        await webhookLog.save();
        throw new BadRequestException('Order not found');
      }

      
      const orderStatus = await this.orderStatusModel.findOne({ 
        collect_id: order._id 
      });

      if (orderStatus) {
        orderStatus.order_amount = webhookData.order_info.order_amount;
        orderStatus.transaction_amount = webhookData.order_info.transaction_amount;
        orderStatus.payment_mode = webhookData.order_info.payment_mode;
        orderStatus.payment_details = webhookData.order_info.payemnt_details;
        orderStatus.bank_reference = webhookData.order_info.bank_reference;
        orderStatus.payment_message = webhookData.order_info.Payment_message;
        orderStatus.status = webhookData.order_info.status;
        orderStatus.error_message = webhookData.order_info.error_message;
        orderStatus.payment_time = new Date(webhookData.order_info.payment_time);

        await orderStatus.save();
      } else {
        
        const newOrderStatus = new this.orderStatusModel({
          collect_id: order._id,
          order_amount: webhookData.order_info.order_amount,
          transaction_amount: webhookData.order_info.transaction_amount,
          payment_mode: webhookData.order_info.payment_mode,
          payment_details: webhookData.order_info.payemnt_details,
          bank_reference: webhookData.order_info.bank_reference,
          payment_message: webhookData.order_info.Payment_message,
          status: webhookData.order_info.status,
          error_message: webhookData.order_info.error_message,
          payment_time: new Date(webhookData.order_info.payment_time)
        });

        await newOrderStatus.save();
      }

      
      webhookLog.status = 'processed';
      await webhookLog.save();

      return {
        success: true,
        message: 'Webhook processed successfully',
        order_id: webhookData.order_info.order_id
      };

    } catch (error) {
      const webhookLog = await this.webhookLogsModel.findOne({ 
        order_id: webhookData.order_info.order_id 
      });
      
      if (webhookLog) {
        webhookLog.status = 'failed';
        webhookLog.error_message = error.message;
        await webhookLog.save();
      }

      throw new BadRequestException(`Webhook processing failed: ${error.message}`);
    }
  }
}
