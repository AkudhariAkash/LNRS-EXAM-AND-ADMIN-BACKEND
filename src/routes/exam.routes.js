const express = require('express');
const router = express.Router();
const Exam = require('../models/exam.model');
const Question = require('../models/question.model');
const { protect } = require('../middleware/auth.middleware');
const multer = require('multer');
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // Limit video file size to 50MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('File must be a video.'));
    }
    cb(null, true);
  },
});

// Start a new exam
router.post('/start', protect, async (req, res) => {
  try {
    const exam = await Exam.create({
      user: req.user._id,
      startTime: new Date(),
      status: 'in-progress', // Exam status is set to 'in-progress' when started
    });
    res.status(201).json(exam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

// Submit an answer for a specific question in the exam
router.post('/:examId/answer', protect, async (req, res) => {
  try {
    const { questionId, answer, code } = req.body;
    const exam = await Exam.findById(req.params.examId);
    
    // Validate exam existence and authorization
    if (!exam || exam.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Validate question existence
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Evaluate the answer based on question type
    const isCorrect = question.section === 'coding'
      ? await evaluateCode(code, question.testCases)
      : answer === question.answer;

    // Save the answer and its correctness
    exam.answers.push({ question: questionId, answer, code, isCorrect });
    await exam.save();

    res.json({ isCorrect });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

// Upload video recording for the exam
router.post('/:examId/recording', protect, upload.single('video'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    
    // Validate exam existence and authorization
    if (!exam || exam.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Save video path to the exam document
    exam.videoRecording = req.file.path;
    await exam.save();

    res.json({ message: 'Recording uploaded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

// End the exam, calculate the score, and save the result
router.post('/:examId/end', protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    
    // Validate exam existence and authorization
    if (!exam || exam.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // End the exam and calculate the score
    exam.endTime = new Date();
    exam.status = 'completed'; // Ensure the exam status is marked as completed
    exam.score = calculateScore(exam.answers);
    await exam.save();

    res.json(exam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error, please try again later' });
  }
});

// Helper function to evaluate code against test cases (sandboxed environment placeholder)
async function evaluateCode(code, testCases) {
  // Placeholder function: Implement actual code evaluation logic
  // This could include running the code in a sandbox environment
  // and checking it against the provided test cases
  
  let isCorrect = true;  // Assume the code passed all test cases for now

  testCases.forEach(testCase => {
    // Simulate running code against each test case and validate
    if (code !== testCase.output) {
      isCorrect = false;
    }
  });

  return isCorrect;
}

// Helper function to calculate the exam score
function calculateScore(answers) {
  return answers.filter(a => a.isCorrect).length;  // Calculate the score based on correct answers
}

module.exports = router;
