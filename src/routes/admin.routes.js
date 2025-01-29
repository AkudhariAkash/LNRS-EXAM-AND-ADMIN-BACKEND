const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Exam = require('../models/exam.model');
const { protect, admin } = require('../middleware/auth.middleware');

// Get all users (admin only) with pagination
router.get('/users', protect, admin, async (req, res) => {
  try {
    // Extract the page number and limit from query params (default to 1 and 10)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch users with pagination
    const users = await User.find().select('-password').skip(skip).limit(limit);

    // Get the total count of users for pagination metadata
    const totalUsers = await User.countDocuments();

    res.status(200).json({
      success: true,
      users,
      totalUsers,
      page,
      totalPages: Math.ceil(totalUsers / limit),
    });
  } catch (err) {
    console.error('Get Users Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: err.message });
  }
});

// Get all exam results (admin only) with pagination
router.get('/exams', protect, admin, async (req, res) => {
  try {
    // Extract the page number and limit from query params (default to 1 and 10)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch exams with pagination
    const exams = await Exam.find()
      .populate('user', 'name email') // Populate user details
      .populate('answers.question', 'text section') // Populate question details
      .skip(skip)
      .limit(limit);

    // Get the total count of exams for pagination metadata
    const totalExams = await Exam.countDocuments();

    res.status(200).json({
      success: true,
      exams,
      totalExams,
      page,
      totalPages: Math.ceil(totalExams / limit),
    });
  } catch (err) {
    console.error('Get Exams Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch exams', error: err.message });
  }
});

// Get exam statistics (admin only)
router.get('/stats', protect, admin, async (req, res) => {
  try {
    const stats = await Exam.aggregate([ 
      {
        $group: {
          _id: null,
          totalExams: { $sum: 1 },
          avgScore: { $avg: '$score' },
          maxScore: { $max: '$score' },
          minScore: { $min: '$score' },
        },
      },
    ]);

    if (!stats.length) {
      return res.status(404).json({ success: false, message: 'No statistics available' });
    }

    res.status(200).json({ success: true, stats: stats[0] });
  } catch (err) {
    console.error('Get Stats Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics', error: err.message });
  }
});

// Delete user (admin only)
router.delete('/users/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the user is associated with any exams before deleting
    const exams = await Exam.find({ user: id });
    if (exams.length > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete user with existing exams' });
    }

    // Proceed to delete the user
    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, message: 'User deleted successfully', user });
  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete user', error: err.message });
  }
});

module.exports = router;
