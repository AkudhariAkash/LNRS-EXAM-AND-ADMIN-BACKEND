require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const winston = require('winston');

// Routes
const authRoutes = require('./routes/auth.routes');
const questionRoutes = require('./routes/question.routes');
const examRoutes = require('./routes/exam.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// Ensure environment variables are set
if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
  console.error("Environment variables MONGODB_URI and/or JWT_SECRET are missing.");
  process.exit(1); // Exit if critical env variables are not defined
}

// Logging setup using Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log', level: 'info' }) // Logs to a file
  ],
});

// Middleware setup
app.use(helmet()); // Security headers
app.use(cors()); // Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON requests
app.use(morgan('dev')); // Log HTTP requests

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again after 15 minutes.'
});
app.use(limiter);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => logger.info('Connected to MongoDB'))
  .catch((err) => {
    logger.error('Error connecting to MongoDB:', err.message);
    logger.error('Ensure your MongoDB URI is correct and MongoDB service is running.');
    process.exit(1); // Exit on database connection failure
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/admin', adminRoutes);

// Root route to confirm the API is running
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

// Favicon handling
app.get('/favicon.ico', (req, res) => res.sendStatus(204));

// Serve static files (optional, e.g., frontend assets)
app.use(express.static(path.join(__dirname, 'public')));

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack || err.message);
  res.status(500).json({ message: 'An unexpected error occurred' });
});

// Graceful shutdown
const closeConnections = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed due to app termination');
    process.exit(0);
  } catch (err) {
    logger.error('Error closing MongoDB connection:', err.message);
    process.exit(1);
  }
};

process.on('SIGINT', closeConnections);
process.on('SIGTERM', closeConnections);
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`API is running on port ${PORT}`);
});
