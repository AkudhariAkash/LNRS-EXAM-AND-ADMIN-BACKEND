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
      index: true, // Ensures database-level uniqueness
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

// Instance method to compare passwords (plaintext comparison)
userSchema.methods.comparePassword = function (candidatePassword) {
  try {
    return this.password === candidatePassword; // Plaintext comparison
  } catch (error) {
    console.error('Error while comparing passwords:', error);
    throw new Error('Error while comparing passwords');
  }
};

// Remove sensitive data (like password) before sending the user object
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password; // Exclude password from the returned object
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
