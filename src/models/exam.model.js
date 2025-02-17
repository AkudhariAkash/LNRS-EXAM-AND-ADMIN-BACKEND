const mongoose = require("mongoose");

// Regex pattern for video URL validation
const videoUrlPattern = /^(https?:\/\/)?([a-z0-9]+\.)+[a-z0-9]{2,4}\/[^\s]*$/;

const examSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to User model
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: { type: Date },

    duration: {
      type: Number, // Duration in minutes
      required: true,
    },

    autoSubmitTimerId: { type: String, default: null }, // Stores auto-submit timer ID

    questions: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question", // Reference to Question model
          required: true,
        },
        section: { type: String, required: true }, // Section of the question
        questionNumber: { type: Number, required: true }, // Unique number in the exam
      },
    ],

    answers: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question", // Reference to Question model
          required: true,
        },
        section: { type: String, required: true }, // Section of the question
        questionNumber: { type: Number, required: true }, // Unique question number
        answer: { type: String, default: null },
        code: { type: String, default: null },
        isCorrect: { type: Boolean, default: false },
      },
    ],

    videoRecording: {
      type: String,
      default: null,
      match: videoUrlPattern, // Validate URL format
    },

    status: {
      type: String,
      enum: ["in-progress", "completed", "terminated"],
      default: "in-progress",
    },

    score: { type: Number, default: 0 },
    
    allowedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }],
  },
  { timestamps: true }
);

// ✅ Method to calculate and update the score
examSchema.methods.calculateScore = async function () {
  if (this.answers.length === 0) return; // Avoid division by zero

  const correctAnswers = this.answers.filter((answer) => answer.isCorrect).length;
  this.score = ((correctAnswers / this.answers.length) * 100).toFixed(2); // Percentage score
  await this.save();
};

// ✅ Method to update exam status and auto-submit
examSchema.methods.completeExam = async function () {
  if (this.status !== "in-progress") return; // Prevent duplicate submissions

  // Clear the auto-submit timer if it exists
  if (this.autoSubmitTimerId) {
    clearTimeout(parseInt(this.autoSubmitTimerId));
    this.autoSubmitTimerId = null;
  }

  this.set({ status: "completed", endTime: new Date() });
  await this.calculateScore(); // Update the score before saving
  await this.save();
};

// ✅ Method to allow video recording upload
examSchema.methods.submitVideo = async function (videoUrl) {
  if (videoUrl && videoUrl.match(videoUrlPattern)) {
    this.videoRecording = videoUrl;
    await this.save();
  } else {
    throw new Error("Invalid video URL format.");
  }
};

// ✅ Automatically submit the exam when time is over
examSchema.methods.scheduleAutoSubmit = function () {
  const now = new Date();
  const examEndTime = new Date(this.startTime.getTime() + this.duration * 60 * 1000);
  const timeLeft = examEndTime - now;

  if (timeLeft <= 0) {
    return this.completeExam(); // If expired, submit immediately
  }

  // Schedule auto-submission only once
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
};

module.exports = mongoose.model("Exam", examSchema);
