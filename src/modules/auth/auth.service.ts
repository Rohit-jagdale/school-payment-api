import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../../schemas/user.schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService
  ) {}

  async create(createUserDto: any): Promise<User> {
    const { email, username, password, role, school_id } = createUserDto;

    this.logger.log(`Registration attempt for email: ${email}, username: ${username}`);

    if (!email || !username || !password) {
      this.logger.warn('Registration failed: Missing required fields');
      throw new BadRequestException('Email, username, and password are required');
    }
    
    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        this.logger.warn(`Registration failed: Email ${email} already exists`);
        throw new ConflictException('An account with this email already exists');
      } else {
        this.logger.warn(`Registration failed: Username ${username} already exists`);
        throw new ConflictException('This username is already taken');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new this.userModel({
      email,
      username,
      password: hashedPassword,
      role: role || 'school_admin',
      school_id
    });

    const savedUser = await user.save();
    this.logger.log(`User registered successfully: ${savedUser._id}`);
    return savedUser;
  }

  async validateUser(email: string, password: string): Promise<any> {
    this.logger.log(`Login attempt for email: ${email}`);

    if (!email || !password) {
      this.logger.warn('Login failed: Missing email or password');
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.userModel.findOne({ email }).select('+password');
    
    if (!user) {
      this.logger.warn(`Login failed: User with email ${email} not found`);
      throw new UnauthorizedException('No account found with this email address');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed: Invalid password for email ${email}`);
      throw new UnauthorizedException('Incorrect password');
    }

    this.logger.log(`User ${user._id} logged in successfully`);
    const { password: _, ...result } = user.toObject();
    return result;
  }

  async findById(id: string): Promise<User> {
    return await this.userModel.findById(id);
  }

  async login(user: any) {
    this.logger.log(`Generating JWT token for user: ${user._id}`);
    
    const payload = { 
      email: user.email, 
      sub: user._id,
      role: user.role,
      school_id: user.school_id
    };
    
    const access_token = this.jwtService.sign(payload);
    
    return {
      access_token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        school_id: user.school_id
      }
    };
  }
}
