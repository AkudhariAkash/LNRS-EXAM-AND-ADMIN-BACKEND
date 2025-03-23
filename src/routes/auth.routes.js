const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { protect, admin } = require('../middleware/auth.middleware');

// Register User
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide both email and password' });
    }

    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.role === 'user') {
      if (user.isLoggedIn) {
        return res.status(403).json({ message: 'User already Taken Exam' });
      }
      if (user.isBlocked) {
        return res.status(403).json({ message: 'EXAM ALREADY TAKEN' });
      }
    }

    user.isLoggedIn = true;
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({ token, message: 'Login successful' });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

// Logout User
router.post('/logout', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      user.isLoggedIn = false; // Admins can log in again
    } else {
      user.isLoggedIn = false;
      user.isBlocked = true; // Users cannot log in again
    }

    await user.save();

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

// Create Admin
router.post('/create-admin', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin with this email already exists' });
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin',
    });

    res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    console.error('Create Admin Error:', error);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

// Admin Login
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide both email and password' });
    }

    const admin = await User.findOne({ email });
    if (!admin || admin.role !== 'admin' || admin.password !== password) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({ token, message: 'Admin logged in successfully' });
  } catch (error) {
    console.error('Admin Login Error:', error);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

// Get Current User
router.get('/me', protect, async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    console.error('Get Current User Error:', error);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

// Update User
router.put('/update-user', protect, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const { id } = req.user;

    if (!name && !email && !password) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (email) updatedFields.email = email;
    if (password) updatedFields.password = password;

    const updatedUser = await User.findByIdAndUpdate(id, updatedFields, { new: true });

    res.json({ user: updatedUser, message: 'User updated successfully' });
  } catch (error) {
    console.error('Update User Error:', error);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

module.exports = router;
