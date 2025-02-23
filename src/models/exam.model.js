const mongoose = require("mongoose");
const fs = require("fs");

// Enhanced Regex pattern for video URL validation
const videoUrlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/;

const examSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: { type: Date },

    duration: {
      type: Number,
      required: true,
    },

    autoSubmitTimerId: { type: String, default: null },

    questions: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
          required: true,
        },
        section: { type: String, required: true },
        questionNumber: { type: Number, required: true },
      },
    ],

    answers: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
          required: true,
        },
        section: { type: String, required: true },
        questionNumber: { type: Number, required: true },
        answer: { type: String, default: null },
        code: { type: String, default: null },
        isCorrect: { type: Boolean, default: false },
        totalTestCases: { type: Number, default: 0 },
        testCasesPassed: { type: Number, default: 0 },
      },
    ],

    videoRecording: {
      type: String,
      default: null,
      match: videoUrlPattern,
    },

    status: {
      type: String,
      enum: ["in-progress", "completed", "terminated"],
      default: "in-progress",
    },

    score: { type: Number, default: 0 },

    allowedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
  },
  { timestamps: true }
);

// ✅ Calculate and update final score
examSchema.methods.calculateScore = async function () {
  try {
    if (this.answers.length === 0) return;

    console.log("Answers for Scoring:", this.answers);

    let mcqMarks = 0;
    let aptitudeMarks = 0;
    let aiMarks = 0;
    let codingScore = 0;

    const sectionMap = {
      "mcqs": "1",
      "aptitude": "2",
      "ai": "3",
      "coding": "4"
    };

    this.answers.forEach((answer) => {
      const section = sectionMap[answer.section] || answer.section.toString();

      if (section === "1" && answer.isCorrect) mcqMarks += 2;
      else if (section === "2" && answer.isCorrect) aptitudeMarks += 2;
      else if (section === "3" && answer.isCorrect) aiMarks += 2;

      if (section === "4") {
        const codingMarks = answer.totalTestCases > 0
          ? (answer.testCasesPassed / answer.totalTestCases) * 20
          : 0;
        codingScore += codingMarks;
      }
    });

    const totalScore = mcqMarks + aptitudeMarks + aiMarks + codingScore;
    this.score = isNaN(totalScore) ? 0 : parseFloat(totalScore.toFixed(2));

     console.log("MCQ Marks:", mcqMarks);
     console.log("Aptitude Marks:", aptitudeMarks);
     console.log("AI Marks:", aiMarks);
     console.log("Coding Marks:", codingScore);
   // console.log("Final Total Score :", this.score);

    await this.save();
    return this.score;
  } catch (error) {
    console.error("Error calculating score:", error);
    throw error;
  }
};

// ✅ Complete the exam and handle auto-submit
examSchema.methods.completeExam = async function () {
  try {
    if (this.status !== "in-progress") return;

    if (this.autoSubmitTimerId) {
      clearTimeout(parseInt(this.autoSubmitTimerId));
      this.autoSubmitTimerId = null;
    }

    this.set({ status: "completed", endTime: new Date() });

    if (!this.videoRecording) {
      this.videoRecording = null;
    }

    const finalScore = await this.calculateScore();
    console.log("Exam Final Total Score:", finalScore);

    await this.save();
  } catch (error) {
    console.error("Error completing exam:", error);
    throw error;
  }
};

// ✅ Upload and validate video recording
examSchema.methods.submitVideo = async function (videoUrl) {
  if (!videoUrl) throw new Error("Video URL is required.");

  if (videoUrl.match(videoUrlPattern)) {
    const videoPath = `C:/Users/akash/OneDrive/Desktop/imp files/project/uploads/${videoUrl}`;

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found at ${videoPath}`);
    }

    this.videoRecording = videoUrl;
    await this.save();
  } else {
    throw new Error("Invalid video URL format.");
  }
};

// ✅ Schedule auto-submit when exam time ends
examSchema.methods.scheduleAutoSubmit = function () {
  try {
    const now = new Date();
    const examEndTime = new Date(this.startTime.getTime() + this.duration * 60 * 1000);
    const timeLeft = examEndTime - now;

    if (timeLeft <= 0) {
      return this.completeExam();
    }

    if (!this.autoSubmitTimerId) {
      const timerId = setTimeout(async () => {
        const exam = await mongoose.model("Exam").findById(this._id);
        if (exam && exam.status === "in-progress") {
          await exam.completeExam();
          console.log(`Exam ${exam._id} auto-submitted.`);
        }
      }, timeLeft);

      this.autoSubmitTimerId = timerId.toString();
      return this.save();
    }
  } catch (error) {
    console.error("Error scheduling auto-submit:", error);
    throw error;
  }
};

// ✅ Compile code and calculate test cases
examSchema.methods.handleRun = async function (code, language, selectedCodingQuestion) {
  if (!selectedCodingQuestion) return;

  const axios = require("axios");
  const testCases = selectedCodingQuestion.testCases || [];
  const results = [];
  let passedTestCases = 0;

  for (const testCase of testCases) {
    try {
      const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language: language.toLowerCase(),
        version: "*",
        files: [{ content: code }],
        stdin: testCase.input,
      });

      const actualOutput = response.data.run.output;
      const status = actualOutput.trim() === testCase.output.trim() ? "correct" : "wrong";

      if (status === "correct") passedTestCases++;

      results.push({ status, actualOutput });
    } catch (error) {
      results.push({
        status: "wrong",
        actualOutput: error instanceof Error ? `Error: ${error.message}` : "An unknown error occurred",
      });
    }
  }

  const answer = this.answers.find((a) => a.question.toString() === selectedCodingQuestion._id.toString());
  if (answer) {
    answer.totalTestCases = testCases.length;
    answer.testCasesPassed = passedTestCases;
    answer.isCorrect = passedTestCases === testCases.length;
  }

  await this.save();

  return results;
};

module.exports = mongoose.model("Exam", examSchema);
