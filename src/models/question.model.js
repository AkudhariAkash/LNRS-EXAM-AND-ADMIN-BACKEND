const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    section: {
      type: String,
      required: true,
      enum: ['mcqs', 'aptitude', 'ai', 'coding'], // Allowed sections
    },
    text: {
      type: String,
      required: true, // Problem statement
    },
    options: {
      type: [String],
      validate: {
        validator: function (value) {
          // Options are required for MCQs, AI, and Aptitude; disallowed for Coding
          return ['mcqs', 'aptitude', 'ai'].includes(this.section)
            ? value && value.length === 4 // Exactly 4 options
            : value === undefined || value.length === 0; // No options for Coding
        },
        message: 'Options must have exactly 4 choices for MCQs, AI, and Aptitude; should not be provided for Coding.',
      },
    },
    answer: {
      type: String,
      required: function () {
        return ['mcqs', 'aptitude', 'ai'].includes(this.section); // Answer is required for these sections
      },
      validate: {
        validator: function (value) {
          return ['mcqs', 'aptitude', 'ai'].includes(this.section)
            ? !!value // Answer is required
            : value === undefined; // No answer for Coding
        },
        message: 'Answer is required for MCQs, AI, and Aptitude and should not be provided for Coding.',
      },
    },
    testCases: {
      type: [
        {
          input: {
            type: String,
            required: true,
          },
          output: {
            type: String,
            required: true,
          },
          isHidden: {
            type: Boolean,
            default: false,
          },
        },
      ],
      validate: {
        validator: function (value) {
          // Test cases are only allowed for 'coding'; disallowed for others
          return this.section === 'coding'
            ? value && value.length > 0 // Ensure test cases are provided for Coding
            : value === undefined || value.length === 0; // No test cases for others
        },
        message: 'Test cases are allowed only for Coding and should not be provided for other sections.',
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true, // Automatically populated in middleware
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Middleware to clean up fields before validation
questionSchema.pre('validate', function (next) {
  if (['mcqs', 'aptitude', 'ai'].includes(this.section)) {
    this.testCases = undefined; // Remove test cases for MCQs, AI, and Aptitude
  }
  if (this.section === 'coding') {
    this.options = undefined; // Remove options for Coding
  }
  next();
});

// Middleware for Managing Test Cases (Coding)
questionSchema.pre('save', function (next) {
  if (this.section === 'coding' && this.testCases.length > 2) {
    // Limit the test cases to two, hiding the rest
    this.testCases = this.testCases.map((testCase, index) => ({
      ...testCase,
      isHidden: index >= 2, // Hide all test cases beyond the first two
    }));
  }
  next();
});

// Indexing for fast querying by createdBy
questionSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Question', questionSchema);
