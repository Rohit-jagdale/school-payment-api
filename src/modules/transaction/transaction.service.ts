import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../../schemas/order.schema';
import { OrderStatus, OrderStatusDocument } from '../../schemas/order-status.schema';

@Injectable()
export class TransactionService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(OrderStatus.name) private orderStatusModel: Model<OrderStatusDocument>
  ) {}

  async getAllTransactions(page: number = 1, limit: number = 10, sortBy: string = 'payment_time', sortOrder: string = 'desc') {
    try {
      const skip = (page - 1) * limit;
      const sortDirection = sortOrder === 'desc' ? -1 : 1;

      const pipeline: any[] = [
        {
          $lookup: {
            from: 'orderstatuses',
            localField: '_id',
            foreignField: 'collect_id',
            as: 'orderStatus'
          }
        },
        {
          $unwind: {
            path: '$orderStatus',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            collect_id: '$_id',
            school_id: '$school_id',
            gateway: '$gateway_name',
            order_amount: '$orderStatus.order_amount',
            transaction_amount: '$orderStatus.transaction_amount',
            status: '$orderStatus.status',
            custom_order_id: '$custom_order_id',
            payment_time: '$orderStatus.payment_time',
            payment_mode: '$orderStatus.payment_mode',
            bank_reference: '$orderStatus.bank_reference',
            student_info: '$student_info'
          }
        },
        {
          $sort: { [sortBy]: sortDirection }
        },
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: limit }
            ],
            totalCount: [
              { $count: 'count' }
            ]
          }
        }
      ];

      const result = await this.orderModel.aggregate(pipeline);
      const transactions = result[0].data;
      const totalCount = result[0].totalCount[0]?.count || 0;

      return {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      throw new BadRequestException(`Failed to fetch transactions: ${error.message}`);
    }
  }

  async getTransactionsBySchool(schoolId: string, page: number = 1, limit: number = 10, sortBy: string = 'payment_time', sortOrder: string = 'desc') {
    try {
      const skip = (page - 1) * limit;
      const sortDirection = sortOrder === 'desc' ? -1 : 1;

      const pipeline: any[] = [
        {
          $match: { school_id: schoolId }
        },
        {
          $lookup: {
            from: 'orderstatuses',
            localField: '_id',
            foreignField: 'collect_id',
            as: 'orderStatus'
          }
        },
        {
          $unwind: {
            path: '$orderStatus',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            collect_id: '$_id',
            school_id: '$school_id',
            gateway: '$gateway_name',
            order_amount: '$orderStatus.order_amount',
            transaction_amount: '$orderStatus.transaction_amount',
            status: '$orderStatus.status',
            custom_order_id: '$custom_order_id',
            payment_time: '$orderStatus.payment_time',
            payment_mode: '$orderStatus.payment_mode',
            bank_reference: '$orderStatus.bank_reference',
            student_info: '$student_info'
          }
        },
        {
          $sort: { [sortBy]: sortDirection }
        },
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: limit }
            ],
            totalCount: [
              { $count: 'count' }
            ]
          }
        }
      ];

      const result = await this.orderModel.aggregate(pipeline);
      const transactions = result[0].data;
      const totalCount = result[0].totalCount[0]?.count || 0;

      return {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      throw new BadRequestException(`Failed to fetch school transactions: ${error.message}`);
    }
  }

  async getTransactionStatus(customOrderId: string) {
    try {
      const pipeline: any[] = [
        {
          $match: { custom_order_id: customOrderId }
        },
        {
          $lookup: {
            from: 'orderstatuses',
            localField: '_id',
            foreignField: 'collect_id',
            as: 'orderStatus'
          }
        },
        {
          $unwind: {
            path: '$orderStatus',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            collect_id: '$_id',
            school_id: '$school_id',
            gateway: '$gateway_name',
            order_amount: '$orderStatus.order_amount',
            transaction_amount: '$orderStatus.transaction_amount',
            status: '$orderStatus.status',
            custom_order_id: '$custom_order_id',
            payment_time: '$orderStatus.payment_time',
            payment_mode: '$orderStatus.payment_mode',
            bank_reference: '$orderStatus.bank_reference',
            payment_message: '$orderStatus.payment_message',
            error_message: '$orderStatus.error_message',
            student_info: '$student_info'
          }
        }
      ];

      const result = await this.orderModel.aggregate(pipeline);
      
      if (result.length === 0) {
        throw new BadRequestException('Transaction not found');
      }

      return result[0];
    } catch (error) {
      throw new BadRequestException(`Failed to get transaction status: ${error.message}`);
    }
  }

  async createDummyData() {
    try {
      // Create dummy orders
      const dummyOrders = [
        {
          school_id: '65b0e6293e9f76a9694d84b4',
          trustee_id: '65b0e552dd31950a9b41c5ba',
          student_info: {
            name: 'John Doe',
            id: 'STU001',
            email: 'john.doe@school.com'
          },
          gateway_name: 'PhonePe',
          custom_order_id: 'ORDER_001'
        },
        {
          school_id: '65b0e6293e9f76a9694d84b4',
          trustee_id: '65b0e552dd31950a9b41c5ba',
          student_info: {
            name: 'Jane Smith',
            id: 'STU002',
            email: 'jane.smith@school.com'
          },
          gateway_name: 'Razorpay',
          custom_order_id: 'ORDER_002'
        }
      ];

      const createdOrders = await this.orderModel.insertMany(dummyOrders);

      // Create dummy order statuses
      const dummyOrderStatuses = [
        {
          collect_id: createdOrders[0]._id,
          order_amount: 2000,
          transaction_amount: 2200,
          payment_mode: 'upi',
          payment_details: 'success@ybl',
          bank_reference: 'YESBNK222',
          payment_message: 'payment success',
          status: 'Success',
          error_message: 'NA',
          payment_time: new Date()
        },
        {
          collect_id: createdOrders[1]._id,
          order_amount: 1500,
          transaction_amount: 1500,
          payment_mode: 'card',
          payment_details: 'Card ending in 1234',
          bank_reference: 'HDFC123',
          payment_message: 'payment success',
          status: 'Success',
          error_message: 'NA',
          payment_time: new Date()
        }
      ];

      await this.orderStatusModel.insertMany(dummyOrderStatuses);

      return { message: 'Dummy data created successfully' };
    } catch (error) {
      throw new BadRequestException(`Failed to create dummy data: ${error.message}`);
    }
  }
}
