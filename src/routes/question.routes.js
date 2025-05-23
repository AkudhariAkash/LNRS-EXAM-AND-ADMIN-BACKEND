const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Question = require('../models/question.model');
const { protect, admin } = require('../middleware/auth.middleware');


// Get all questions (admin only)
router.get('/admin', protect, admin, async (req, res) => {
  try {
    const questions = await Question.find().populate('createdBy', 'name email');
    res.json({ success: true, data: questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error, please try again later.' });
  }
});

// Get all questions for the user exam portal (No authentication required)
router.get('/user', async (req, res) => {
  try {
    const sections = ['mcqs', 'aptitude', 'ai', 'coding'];
    const questions = {};

    for (const section of sections) {
      questions[section] = await Question.find({ section }).sort({ questionNumber: 1 });
    }

    res.json({ success: true, data: questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error, please try again later.' });
  }
});

// Create new question (admin only)
router.post('/', protect, admin, async (req, res) => {
  try {
    const { section, text, options, answer, testCases, questionNumber } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Question text is required.' });
    }

    if (['mcqs', 'aptitude', 'ai'].includes(section)) {
      if (!options || options.length !== 4) {
        return res.status(400).json({ success: false, message: 'Options must have exactly 4 choices.' });
      }
      if (!answer) {
        return res.status(400).json({ success: false, message: 'Answer is required.' });
      }
    }

    if (section === 'coding' && (!testCases || testCases.length === 0)) {
      return res.status(400).json({ success: false, message: 'At least one test case is required for coding questions.' });
    }

    const question = new Question({
      ...req.body,
      createdBy: req.user._id,
    });

    await question.save();
    res.status(201).json({ success: true, data: question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error, please try again later.' });
  }
});

// Update question (admin only)
router.put('/:id', protect, admin, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid question ID' });
  }

  try {
    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const { section, options, answer, testCases } = req.body;

    if (['mcqs', 'aptitude', 'ai'].includes(section)) {
      if (options && options.length !== 4) {
        return res.status(400).json({ success: false, message: 'Options must have exactly 4 choices.' });
      }
      if (!answer) {
        return res.status(400).json({ success: false, message: 'Answer is required.' });
      }
    }

    if (section === 'coding' && testCases && testCases.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one test case is required for coding questions.' });
    }

    Object.assign(question, req.body);
    await question.save();

    res.json({ success: true, data: question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error, please try again later.' });
  }
});

// Delete question (admin only)
router.delete('/:id', protect, admin, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid question ID' });
  }

  try {
    const question = await Question.findByIdAndDelete(id);

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error, please try again later.' });
  }
});

module.exports = router;
