const express = require("express");
const router = express.Router();
const Exam = require("../models/exam.model");
const Question = require("../models/question.model");
const { protect } = require("../middleware/auth.middleware");
const multer = require("multer");

// ✅ Configure Multer for Secure Video Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Limit video size to 50MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("File must be a video."));
    }
    cb(null, true);
  },
});

// ✅ Start a New Exam
router.post("/start", protect, async (req, res) => {
  try {
    const { duration, allowedUsers } = req.body;
    if (!duration || duration <= 0) {
      return res.status(400).json({ message: "Invalid exam duration" });
    }

    const exam = await Exam.create({
      user: req.user._id,
      startTime: new Date(),
      duration,
      allowedUsers,
      status: "in-progress",
    });

    exam.scheduleAutoSubmit();
    res.status(201).json({ success: true, exam });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Submit an Answer
router.post("/:examId/answer", protect, async (req, res) => {
  try {
    const { section, questionNumber, answer, code } = req.body;
    const exam = await Exam.findById(req.params.examId);

    if (!exam || String(exam.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (exam.status !== "in-progress") {
      return res.status(400).json({ message: "Exam already ended" });
    }

    const question = await Question.findOne({ section }).sort({ createdAt: 1 }).skip(questionNumber - 1).exec();

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const isCorrect = question.section === "coding"
      ? await evaluateCode(code, question.testCases)
      : answer === question.answer;

    exam.answers.push({
      question: question._id,
      section,
      questionNumber,
      answer,
      code,
      isCorrect,
    });

    await exam.save();
    res.json({ success: true, isCorrect });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Upload Video Recording
router.post("/:examId/recording", protect, upload.single("video"), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);

    if (!exam || String(exam.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (exam.status !== "in-progress") {
      return res.status(400).json({ message: "Exam already ended" });
    }

    exam.videoRecording = req.file.path;
    await exam.save();

    res.json({ success: true, message: "Recording uploaded successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ End the Exam Manually
router.post("/:examId/end", protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);

    if (!exam || String(exam.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (exam.status !== "in-progress") {
      return res.status(400).json({ message: "Exam already ended" });
    }

    await exam.completeExam();
    res.json({ success: true, message: "Exam submitted successfully", exam });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Auto-submit the Exam
async function autoSubmitExam(examId) {
  try {
    const exam = await Exam.findById(examId);
    if (!exam || exam.status !== "in-progress") return;

    await exam.completeExam();
  } catch (err) {
    console.error("🔥 [Error] Auto-submitting Exam:", err.message);
  }
}

// ✅ Evaluate Code Against Test Cases
async function evaluateCode(code, testCases) {
  return testCases.every((testCase) => code.trim() === testCase.output.trim());
}

module.exports = router;