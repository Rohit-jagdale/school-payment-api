import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

@Schema()
export class StudentInfo {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  email: string;
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, type: Types.ObjectId })
  school_id: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  trustee_id: Types.ObjectId;

  @Prop({ type: StudentInfo, required: true })
  student_info: StudentInfo;

  @Prop({ required: true })
  gateway_name: string;

  @Prop({ unique: true, required: true })
  custom_order_id: string;

  @Prop({ required: false })
  collect_request_id: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);


OrderSchema.index({ school_id: 1 });
OrderSchema.index({ custom_order_id: 1 });
OrderSchema.index({ trustee_id: 1 });
