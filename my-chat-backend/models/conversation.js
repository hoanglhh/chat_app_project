const mongoose = require('mongoose')

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group', 'ai'],
      required: true
    },
    name: {
      type: String,
      trim: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true
  }
)

conversationSchema.path('participants').validate(
  function (participants) {
    if (this.type === 'ai') {
      return participants.length === 1
    }

    if (this.type === 'direct') {
      return participants.length === 2
    }

    return participants.length >= 2
  },
  'invalid number of conversation participants'
)

conversationSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Conversation', conversationSchema)