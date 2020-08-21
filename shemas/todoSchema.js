const { Schema } = require('mongoose')

const todoSchema = new Schema({
  _id: {
    type: String,
    default() {
      return uuidv4()
    },
  },
  text: { type: String, required: true },
  isComplete: { type: Boolean, required: true },
  userId: { type: String, required: true },
})

module.exports = todoSchema
