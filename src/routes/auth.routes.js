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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({ token, message: 'User registered successfully' });
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

     const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

     res.json({ token, message: 'Login successful' });
   } catch (error) {
     console.error('Login Error:', error);
     res.status(500).json({ message: 'Server error, please try again later' });
   }
 });

 // Get Current User (Protected Route)
 router.get('/me', protect, async (req, res) => {
   try {
     res.json(req.user);
   } catch (error) {
     console.error('Get Current User Error:', error);
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

     const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
       expiresIn: '1d',
     });

     res.status(201).json({ token, message: 'Admin created successfully' });
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

    const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.json({ token, message: 'Admin logged in successfully' });
  } catch (error) {
    console.error('Admin Login Error:', error);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

// Update user (Protected Route)
router.put('/update-user', protect, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const { userId } = req.user;

    if (!name && !email && !password) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (email) updatedFields.email = email;
    if (password) updatedFields.password = password; // Plaintext password

    const updatedUser = await User.findByIdAndUpdate(userId, updatedFields, { new: true });

    res.json({ user: updatedUser, message: 'User updated successfully' });
  } catch (error) {
    console.error('Update User Error:', error);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

module.exports = router;
