import { IsString, IsNumber, IsObject, ValidateNested, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderInfoDto {
  @IsString()
  order_id: string;

  @IsNumber()
  order_amount: number;

  @IsNumber()
  transaction_amount: number;

  @IsString()
  gateway: string;

  @IsString()
  bank_reference: string;

  @IsString()
  status: string;

  @IsString()
  payment_mode: string;

  @IsString()
  payemnt_details: string;

  @IsString()
  Payment_message: string;

  @IsDateString()
  payment_time: string;

  @IsString()
  error_message: string;
}

export class WebhookDto {
  @IsNumber()
  status: number;

  @IsObject()
  @ValidateNested()
  @Type(() => OrderInfoDto)
  order_info: OrderInfoDto;
}
