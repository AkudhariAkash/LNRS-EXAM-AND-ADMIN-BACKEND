const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Middleware to verify user authentication
exports.protect = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    // If no token is provided, deny access
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authorization denied: No token provided.',
      });
    }

    // Verify token and decode the payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user associated with the token
    const user = await User.findById(decoded.id).select('-password'); // Exclude password from returned fields

    // If the user is not found, deny access
    if (!user) {
      console.error(`Authorization failed: User not found for ID ${decoded.id}`);
      return res.status(401).json({
        success: false,
        message: 'Authorization denied: User not found.',
      });
    }

    // Attach user to the request object
    req.user = user;
    next();
  } catch (err) {
    console.error('Authorization error:', err.message);

    // Handle specific JWT errors
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
      });
    }

    // Catch any other errors related to the token (e.g., invalid token)
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Authorization denied.',
    });
  }
};

// Middleware to verify admin access
exports.admin = (req, res, next) => {
  try {
    // Check if the user role is admin
    if (req.user.role !== 'admin') {
      console.error('Access denied: User does not have admin privileges.');
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin privileges required.',
      });
    }
    next();
  } catch (err) {
    console.error('Admin authorization error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error. Unable to verify admin privileges.',
    });
  }
};
