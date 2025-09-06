import { IsString, IsNumber, IsEmail, IsObject, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class StudentInfoDto {
  @IsString()
  name: string;

  @IsString()
  id: string;

  @IsEmail()
  email: string;
}

export class CreatePaymentDto {
  @IsString()
  school_id: string;

  @IsString()
  trustee_id: string;

  @IsObject()
  @ValidateNested()
  @Type(() => StudentInfoDto)
  student_info: StudentInfoDto;

  @IsString()
  gateway_name: string;

  @IsNumber()
  order_amount: number;

  @IsOptional()
  @IsString()
  custom_order_id?: string;
}
