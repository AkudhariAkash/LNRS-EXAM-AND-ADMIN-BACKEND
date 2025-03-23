const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      match: [/^[a-zA-Z\s]+$/, 'Name should only contain letters and spaces'],
      minlength: [3, 'Name must be at least 3 characters long'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [5, 'Password must be at least 5 characters long'],
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    isLoggedIn: { type: Boolean, default: false }, // Tracks if user is logged in
    isBlocked: { type: Boolean, default: false }, // Blocks re-login after logout
  },
  { timestamps: true }
);

// Pre-save middleware to lowercase email
userSchema.pre('save', function (next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase();
  }
  next();
});

// Compare passwords (plaintext)
userSchema.methods.comparePassword = function (candidatePassword) {
  return this.password === candidatePassword;
};

// Remove sensitive data before sending response
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
