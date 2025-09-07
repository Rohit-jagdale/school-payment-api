import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderStatusDocument = OrderStatus & Document;

@Schema({ timestamps: true })
export class OrderStatus {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  collect_id: Types.ObjectId;

  @Prop({ required: true })
  order_amount: number;

  @Prop({ required: true })
  transaction_amount: number;

  @Prop({ required: true })
  payment_mode: string;

  @Prop({ required: true })
  payment_details: string;

  @Prop({ required: true })
  bank_reference: string;

  @Prop({ required: true })
  payment_message: string;

  @Prop({ enum: ['pending', 'success', 'failed', 'cancelled', 'completed'], default: 'pending' })
  status: string;

  @Prop({ default: 'NA' })
  error_message: string;

  @Prop({ default: Date.now })
  payment_time: Date;
}

export const OrderStatusSchema = SchemaFactory.createForClass(OrderStatus);

// Create indexes for better performance
OrderStatusSchema.index({ collect_id: 1 });
OrderStatusSchema.index({ status: 1 });
OrderStatusSchema.index({ payment_time: -1 });
