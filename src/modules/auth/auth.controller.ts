import { Controller, Post, Body, UseGuards, Get, Request, UnauthorizedException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { LoginDto, RegisterDto } from '../../dto/auth.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    try {
      this.logger.log(`Registration request received for email: ${registerDto.email}`);
      const result = await this.authService.create(registerDto);
      this.logger.log(`Registration successful for user: ${(result as any)._id}`);
      return result;
    } catch (error) {
      this.logger.error(`Registration failed for email: ${registerDto.email}`, error.stack);
      throw error;
    }
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      this.logger.log(`Login request received for email: ${loginDto.email}`);
      const user = await this.authService.validateUser(loginDto.email, loginDto.password);
      const result = await this.authService.login(user);
      this.logger.log(`Login successful for user: ${user._id}`);
      return result;
    } catch (error) {
      this.logger.error(`Login failed for email: ${loginDto.email}`, error.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
