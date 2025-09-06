const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/school-payment-db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'school_admin', 'trustee'], default: 'school_admin' },
  school_id: { type: String, required: false },
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  school_id: { type: String, required: true },
  trustee_id: { type: String, required: true },
  student_info: {
    name: { type: String, required: true },
    id: { type: String, required: true },
    email: { type: String, required: true }
  },
  gateway_name: { type: String, required: true },
  custom_order_id: { type: String, unique: true, required: true }
}, { timestamps: true });

const orderStatusSchema = new mongoose.Schema({
  collect_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  order_amount: { type: Number, required: true },
  transaction_amount: { type: Number, required: true },
  payment_mode: { type: String, required: true },
  payment_details: { type: String, required: true },
  bank_reference: { type: String, required: true },
  payment_message: { type: String, required: true },
  status: { type: String, enum: ['pending', 'success', 'failed', 'cancelled'], default: 'pending' },
  error_message: { type: String, default: 'NA' },
  payment_time: { type: Date, default: Date.now }
}, { timestamps: true });

const webhookLogsSchema = new mongoose.Schema({
  order_id: { type: String, required: true },
  webhook_payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['received', 'processed', 'failed'], default: 'received' },
  processed_at: { type: Date, default: Date.now },
  error_message: { type: String, default: null }
}, { timestamps: true });

// Models
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const OrderStatus = mongoose.model('OrderStatus', orderStatusSchema);
const WebhookLogs = mongoose.model('WebhookLogs', webhookLogsSchema);

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'School Payment API is running',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password, role, school_id } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(409).json({ message: 'User with this email or username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'school_admin',
      school_id
    });

    await user.save();
    res.status(201).json({ message: 'User created successfully', userId: user._id });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { email: user.email, sub: user._id, role: user.role, school_id: user.school_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      access_token: token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        school_id: user.school_id
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

app.get('/auth/profile', authenticateToken, (req, res) => {
  res.json(req.user);
});

// Payment routes
app.post('/payment/create-payment', authenticateToken, async (req, res) => {
  try {
    const { school_id, trustee_id, student_info, gateway_name, order_amount } = req.body;

    // Generate custom order ID
    const customOrderId = `ORDER_${Date.now()}_${uuidv4().substring(0, 8)}`;

    // Create order
    const order = new Order({
      school_id,
      trustee_id,
      student_info,
      gateway_name,
      custom_order_id: customOrderId
    });

    const savedOrder = await order.save();

    // Create order status
    const orderStatus = new OrderStatus({
      collect_id: savedOrder._id,
      order_amount,
      transaction_amount: order_amount,
      payment_mode: 'pending',
      payment_details: 'Payment initiated',
      bank_reference: 'N/A',
      payment_message: 'Payment initiated',
      status: 'pending',
      error_message: 'NA'
    });

    await orderStatus.save();

    // Prepare payment gateway payload
    const paymentPayload = {
      pg_key: process.env.PG_KEY,
      school_id: process.env.SCHOOL_ID,
      order_id: customOrderId,
      order_amount,
      student_info,
      gateway_name
    };

    // Generate JWT token for payment API
    const jwtToken = jwt.sign(paymentPayload, process.env.API_KEY, { expiresIn: '1h' });

    // For demo purposes, return a mock payment URL
    res.json({
      success: true,
      order_id: customOrderId,
      payment_url: `https://payment-gateway.com/pay/${customOrderId}`,
      message: 'Payment initiated successfully'
    });

  } catch (error) {
    res.status(500).json({ message: 'Payment creation failed', error: error.message });
  }
});

app.get('/payment/status/:customOrderId', authenticateToken, async (req, res) => {
  try {
    const { customOrderId } = req.params;
    const order = await Order.findOne({ custom_order_id: customOrderId });
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const orderStatus = await OrderStatus.findOne({ collect_id: order._id });
    
    res.json({
      order_id: customOrderId,
      status: orderStatus?.status || 'pending',
      payment_details: orderStatus?.payment_details || 'N/A',
      payment_time: orderStatus?.payment_time || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get payment status', error: error.message });
  }
});

// Transaction routes
app.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'payment_time', sortOrder = 'desc' } = req.query;
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const pipeline = [
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
            { $limit: parseInt(limit) }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ];

    const result = await Order.aggregate(pipeline);
    const transactions = result[0].data;
    const totalCount = result[0].totalCount[0]?.count || 0;

    res.json({
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
});

app.get('/transactions/school/:schoolId', authenticateToken, async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 10, sortBy = 'payment_time', sortOrder = 'desc' } = req.query;
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const pipeline = [
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
            { $limit: parseInt(limit) }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ];

    const result = await Order.aggregate(pipeline);
    const transactions = result[0].data;
    const totalCount = result[0].totalCount[0]?.count || 0;

    res.json({
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch school transactions', error: error.message });
  }
});

app.get('/transactions/status/:customOrderId', authenticateToken, async (req, res) => {
  try {
    const { customOrderId } = req.params;

    const pipeline = [
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

    const result = await Order.aggregate(pipeline);
    
    if (result.length === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get transaction status', error: error.message });
  }
});

app.post('/transactions/dummy-data', authenticateToken, async (req, res) => {
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

    const createdOrders = await Order.insertMany(dummyOrders);

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
        status: 'success',
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
        status: 'success',
        error_message: 'NA',
        payment_time: new Date()
      }
    ];

    await OrderStatus.insertMany(dummyOrderStatuses);

    res.json({ message: 'Dummy data created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create dummy data', error: error.message });
  }
});

// Webhook route
app.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;

    // Log webhook payload
    const webhookLog = new WebhookLogs({
      order_id: webhookData.order_info.order_id,
      webhook_payload: webhookData,
      status: 'received'
    });

    await webhookLog.save();

    // Find the order
    const order = await Order.findOne({ 
      custom_order_id: webhookData.order_info.order_id 
    });

    if (!order) {
      webhookLog.status = 'failed';
      webhookLog.error_message = 'Order not found';
      await webhookLog.save();
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update order status
    const orderStatus = await OrderStatus.findOne({ 
      collect_id: order._id 
    });

    if (orderStatus) {
      orderStatus.order_amount = webhookData.order_info.order_amount;
      orderStatus.transaction_amount = webhookData.order_info.transaction_amount;
      orderStatus.payment_mode = webhookData.order_info.payment_mode;
      orderStatus.payment_details = webhookData.order_info.payemnt_details;
      orderStatus.bank_reference = webhookData.order_info.bank_reference;
      orderStatus.payment_message = webhookData.order_info.Payment_message;
      orderStatus.status = webhookData.order_info.status;
      orderStatus.error_message = webhookData.order_info.error_message;
      orderStatus.payment_time = new Date(webhookData.order_info.payment_time);

      await orderStatus.save();
    } else {
      // Create new order status
      const newOrderStatus = new OrderStatus({
        collect_id: order._id,
        order_amount: webhookData.order_info.order_amount,
        transaction_amount: webhookData.order_info.transaction_amount,
        payment_mode: webhookData.order_info.payment_mode,
        payment_details: webhookData.order_info.payemnt_details,
        bank_reference: webhookData.order_info.bank_reference,
        payment_message: webhookData.order_info.Payment_message,
        status: webhookData.order_info.status,
        error_message: webhookData.order_info.error_message,
        payment_time: new Date(webhookData.order_info.payment_time)
      });

      await newOrderStatus.save();
    }

    // Update webhook log status
    webhookLog.status = 'processed';
    await webhookLog.save();

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      order_id: webhookData.order_info.order_id
    });

  } catch (error) {
    res.status(500).json({ message: 'Webhook processing failed', error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
