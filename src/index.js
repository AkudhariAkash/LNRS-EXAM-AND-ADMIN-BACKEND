require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const winston = require('winston');

// Import Routes
const authRoutes = require('./routes/auth.routes');
const questionRoutes = require('./routes/question.routes');
const examRoutes = require('./routes/exam.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
  console.error("❌ ERROR: Required environment variables are missing.");
  process.exit(1);
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log', level: 'info' })
  ],
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: '🚨 Too many requests, please try again later.'
});
app.use(limiter);

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => logger.info('✅ MongoDB connected successfully!'))
  .catch((err) => {
    logger.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.json({
    message: '🚀 API is running!',
    version: '1.0.0',
    uptime: process.uptime() + " seconds",
    timestamp: new Date().toISOString()
  });
});

app.get('/favicon.ico', (req, res) => res.sendStatus(204));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.status(404).json({ message: '❌ Route not found' });
});

app.use((err, req, res, next) => {
  logger.error(`🔥 ERROR: ${err.stack || err.message}`);
  res.status(500).json({ message: '❌ An unexpected error occurred' });
});

const closeConnections = async () => {
  try {
    await mongoose.connection.close();
    logger.info('🔄 MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Failed to close MongoDB connection:', err.message);
    process.exit(1);
  }
};

process.on('SIGINT', closeConnections);
process.on('SIGTERM', closeConnections);
process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Unhandled Rejection:', promise, 'Reason:', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});
