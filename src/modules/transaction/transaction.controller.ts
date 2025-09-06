import { Controller, Get, Param, Query, UseGuards, Post } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  async getAllTransactions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('sortBy') sortBy: string = 'payment_time',
    @Query('sortOrder') sortOrder: string = 'desc'
  ) {
    return await this.transactionService.getAllTransactions(
      parseInt(page),
      parseInt(limit),
      sortBy,
      sortOrder
    );
  }

  @Get('school/:schoolId')
  async getTransactionsBySchool(
    @Param('schoolId') schoolId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('sortBy') sortBy: string = 'payment_time',
    @Query('sortOrder') sortOrder: string = 'desc'
  ) {
    return await this.transactionService.getTransactionsBySchool(
      schoolId,
      parseInt(page),
      parseInt(limit),
      sortBy,
      sortOrder
    );
  }

  @Get('status/:customOrderId')
  async getTransactionStatus(@Param('customOrderId') customOrderId: string) {
    return await this.transactionService.getTransactionStatus(customOrderId);
  }

  @Post('dummy-data')
  async createDummyData() {
    return await this.transactionService.createDummyData();
  }
}
