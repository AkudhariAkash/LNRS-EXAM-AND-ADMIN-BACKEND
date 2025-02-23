const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const Exam = require("../models/exam.model");
const Question = require("../models/question.model");
const { protect, admin } = require("../middleware/auth.middleware");
const multer = require("multer");

// ✅ Ensure Upload Directory Exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

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
    console.error("Error starting exam:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
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

    if (question.section === "coding") {
      const { isCorrect, totalTestCases, testCasesPassed } = await evaluateCode(code, question.testCases);

      exam.answers.push({
        question: question._id,
        section,
        questionNumber,
        answer,
        code,
        isCorrect,
        totalTestCases,
        testCasesPassed,
      });
    } else {
      exam.answers.push({
        question: question._id,
        section,
        questionNumber,
        answer,
        isCorrect: answer === question.answer,
      });
    }

    await exam.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Error submitting answer:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
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

    if (!req.file) {
      return res.status(400).json({ message: "No video uploaded" });
    }

    const filePath = req.file.path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Uploaded file not found" });
    }

    exam.videoRecording = filePath;
    await exam.save();

    res.json({ success: true, message: "Recording uploaded successfully" });
  } catch (err) {
    console.error("Error uploading recording:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// ✅ End the Exam Manually
router.post("/:examId/end", protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (String(exam.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (exam.status !== "in-progress") {
      return res.status(400).json({ message: "Exam already ended" });
    }

    if (!exam.videoRecording) {
      exam.videoRecording = null;
    }

    await exam.completeExam();
    res.json({ success: true, message: "Exam submitted successfully", exam });
  } catch (err) {
    console.error("Error ending exam:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// ✅ Admin: View User Responses
router.get("/:examId/submissions", protect, admin, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId).populate({
      path: "answers.question",
      select: "text options answer section",
    });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    res.json({ success: true, responses: exam.answers });
  } catch (err) {
    console.error("Error fetching submissions:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// ✅ Piston Compiler Route
router.post("/compile", protect, async (req, res) => {
  try {
    const { code, language, stdin } = req.body;

    const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
      language: language.toLowerCase(),
      version: "*",
      files: [{ content: code }],
      stdin: stdin || "",
    });

    res.json({ success: true, output: response.data.run.output });
  } catch (err) {
    console.error("Error compiling code:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// ✅ Auto-submit the Exam
async function autoSubmitExam(examId) {
  try {
    const exam = await Exam.findById(examId);
    if (!exam || exam.status !== "in-progress") return;

    if (!exam.videoRecording) {
      exam.videoRecording = null;
    }

    await exam.completeExam();
  } catch (err) {
    console.error("🔥 [Error] Auto-submitting Exam:", err.message);
  }
}

// ✅ Evaluate Code Against Test Cases
async function evaluateCode(code, testCases, language = "python3") {
  let passedTestCases = 0;

  for (const testCase of testCases) {
    try {
      const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language: language.toLowerCase(),
        version: "*",
        files: [{ content: code }],
        stdin: testCase.input || "",
      });

      const output = response.data.run.output.trim();
      const expectedOutput = testCase.output.trim();

      if (output === expectedOutput) {
        passedTestCases += 1;
      }
    } catch (err) {
      console.error("Error evaluating test case:", err);
    }
  }

  return {
    totalTestCases: testCases.length,
    testCasesPassed: passedTestCases,
    isCorrect: passedTestCases === testCases.length,
  };
}

// ✅ Multer Error Handling
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  } else if (err) {
    console.error("Unhandled Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
  next();
});

module.exports = router;
