import { Controller, Post, Body } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookDto } from '../../dto/webhook.dto';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  async processWebhook(@Body() webhookData: WebhookDto) {
    return await this.webhookService.processWebhook(webhookData);
  }
}
