const mongoose = require('mongoose');

// Regex pattern for video URL validation (basic validation)
const videoUrlPattern = /^(https?:\/\/)?([a-z0-9]+\.)+[a-z0-9]{2,4}\/[^\s]*$/;

const examSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to User model
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    answers: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question', // Reference to Question model
          required: true,
        },
        answer: {
          type: String,
          default: null,
        },
        code: {
          type: String,
          default: null,
        },
        isCorrect: {
          type: Boolean,
          default: false,
        },
      },
    ],
    videoRecording: {
      type: String,
      default: null,
      match: videoUrlPattern, // Validate URL format
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed', 'terminated'],
      default: 'in-progress',
    },
    score: {
      type: Number,
      default: 0,
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question', // The list of questions for this exam
      },
    ],
  },
  { timestamps: true }
);

// Method to calculate and update the score based on answers
examSchema.methods.calculateScore = async function () {
  const totalQuestions = this.answers.length;
  const correctAnswers = this.answers.filter((answer) => answer.isCorrect).length;

  this.score = (correctAnswers / totalQuestions) * 100; // Simple score calculation
  await this.save(); // Save the updated score to the database
};

// Method to update exam status and set the end time
examSchema.methods.completeExam = async function () {
  this.status = 'completed';
  this.endTime = Date.now();
  await this.save();
};

// Method to allow video recording URL upload (optional field)
examSchema.methods.submitVideo = async function (videoUrl) {
  if (videoUrl && videoUrl.match(videoUrlPattern)) {
    this.videoRecording = videoUrl;
    await this.save();
  } else {
    throw new Error('Invalid video URL format.');
  }
};

module.exports = mongoose.model('Exam', examSchema);
