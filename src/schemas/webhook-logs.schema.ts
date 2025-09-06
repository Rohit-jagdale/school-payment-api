import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WebhookLogsDocument = WebhookLogs & Document;

@Schema({ timestamps: true })
export class WebhookLogs {
  @Prop({ required: true })
  order_id: string;

  @Prop({ type: Object, required: true })
  webhook_payload: any;

  @Prop({ enum: ['received', 'processed', 'failed'], default: 'received' })
  status: string;

  @Prop({ default: Date.now })
  processed_at: Date;

  @Prop({ default: null })
  error_message: string;
}

export const WebhookLogsSchema = SchemaFactory.createForClass(WebhookLogs);

// Create indexes for better performance
WebhookLogsSchema.index({ order_id: 1 });
WebhookLogsSchema.index({ status: 1 });
WebhookLogsSchema.index({ processed_at: -1 });
