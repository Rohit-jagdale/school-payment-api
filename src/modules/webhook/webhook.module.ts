import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { Order, OrderSchema } from '../../schemas/order.schema';
import { OrderStatus, OrderStatusSchema } from '../../schemas/order-status.schema';
import { WebhookLogs, WebhookLogsSchema } from '../../schemas/webhook-logs.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderStatus.name, schema: OrderStatusSchema },
      { name: WebhookLogs.name, schema: WebhookLogsSchema }
    ])
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService]
})
export class WebhookModule {}
