const conversationsRouter = require('express').Router()
const Conversation = require('../models/conversation')
const User = require('../models/user')
const jwt = require('jsonwebtoken')
const config = require('../utils/config')
const Message = require('../models/message')
const { summarizeMessages } = require('../services/gemini')
const { rateLimit } = require('express-rate-limit')

const getTokenFrom = req => {
  const authorization = req.get('authorization')

  if (authorization?.startsWith('Bearer ')) {
    return authorization.replace('Bearer ', '')
  }

  return null
}

const authenticateSummaryRequest = (req, res, next) => {
  try {
    const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)

    if (!decodedToken.id) {
      return res.status(401).json({
        error: 'token invalid'
      })
    }

    req.decodedToken = decodedToken
    next()
  } catch (error) {
    next(error)
  }
}

const summaryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req => req.decodedToken.id,
  message: {
    error: 'Too many summary requests. Please try again in 10 minutes.'
  }
})

conversationsRouter.get('/', async (req, res) => {
  const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)
  if (!decodedToken.id) {
    return res.status(401).json({
      error: 'token invalid'
    })
  }

  const conversations = await Conversation
    .find({
      participants: decodedToken.id
    })
    .populate('participants', 'username name')
    
    return res.json(conversations)
})

conversationsRouter.post('/', async (req, res) => {
  const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)
  if (!decodedToken.id) {
    return res.status(401).json({
      error: 'token invalid'
    })
  }

  const { participantId } = req.body
  if (!participantId) {
    return res.status(400).json({
      error: 'participantId is required'
    })
  }

  if (participantId === decodedToken.id) {
    return res.status(400).json({
      error: 'cannot create a conversation with yourself'
    })
  }

  const participant = await User.findById(participantId)

  if (!participant) {
    return res.status(404).json({ error: 'user not found' })
  }

  const existingConversation = await Conversation.findOne({
    type: 'direct',
    participants: {
      $all: [decodedToken.id, participantId],
      $size: 2,
    }
  })
  
  if (existingConversation) {
    await existingConversation.populate('participants', 'username name')
    return res.status(200).json(existingConversation)
  }

  const conversation = new Conversation({
    type: 'direct',
    participants: [decodedToken.id, participantId],
    createdBy: decodedToken.id
  })

  const savedConversation = await conversation.save()
  await savedConversation.populate('participants', 'username name')

  return res.status(201).json(savedConversation)
}) 

conversationsRouter.get('/:conversationId/messages', async (req, res) => {
    const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)
    if (!decodedToken.id) {
      return res.status(401).json({
        error: 'token invalid'
      })
    }

    const conversation = await Conversation.findById(req.params.conversationId)

    if (!conversation) {
      return res.status(404).json({
        error: 'conversation not found'
      })
    }

    const isParticipant = conversation.participants.some(
      participantId => participantId.toString() === decodedToken.id
    )

    if (!isParticipant) {
      return res.status(403).json({
        error: 'not allowed to access this conversation'
      })
    }

    const messages = await Message
      .find({ conversation: conversation.id })
      .sort({ createdAt: 1 })

    return res.json(messages)
  }
)

conversationsRouter.post(
  '/:conversationId/summary',
  authenticateSummaryRequest,
  summaryLimiter,
  async (req, res) => {
    const decodedToken = req.decodedToken

    const conversation = await Conversation.findById(req.params.conversationId)
    if (!conversation) {
      return res.status(404).json({
        error: 'conversation not found'
      })
    }

    const isParticipant = conversation.participants.some(
      participantId => participantId.toString() === decodedToken.id
    )

    if (!isParticipant) {
      return res.status(403).json({
        error: 'not allowed to summarize this conversation'
      })
    }

    const messages = await Message
      .find({ conversation: conversation._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    messages.reverse()

    const summary = await summarizeMessages(messages)

    return res.json({ summary })
  }
)

conversationsRouter.post('/:conversationId/messages', async (req, res) => {
  const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)
  if (!decodedToken.id) {
    return res.status(401).json({
      error: 'token invalid'
    })
  }

  const user = await User.findById(decodedToken.id)
  if (!user) {
    return res.status(401).json({
      error: 'user missing or invalid'
    })
  }

  const conversation = await Conversation.findById(req.params.conversationId)
  if (!conversation) {
    return res.status(404).json({
      error: 'conversation not found'
    })
  }

  const isParticipant = conversation.participants.some(
    participantId => participantId.toString() === decodedToken.id)
  if (!isParticipant) {
    return res.status(403).json({
      error: 'not allowed to send messages to this conversation'
    })
  }

  const content = req.body.content?.trim()
  if (!content) {
    return res.status(400).json({
      error: 'content missing'
    })
  }

  const message = new Message({
    name: user.name || user.username,
    content,
    user: user._id,
    conversation: conversation._id
  })

  const savedMessage = await message.save()

  user.messages = user.messages.concat(savedMessage._id)
  await user.save()

  const io = req.app.get('io')

  io.to(conversation.id).emit(
    'message:created',
    savedMessage.toJSON()
  )

  return res.status(201).json(savedMessage)
  })

conversationsRouter.put('/:conversationId/messages/:messageId', async (req, res) => {
  const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)
  if (!decodedToken.id) {
    return res.status(401).json({
      error: 'token invalid'
    })
  }

  const conversation = await Conversation.findById(req.params.conversationId)
  if(!conversation) {
    return res.status(404).json({
      error: 'conversation not found'
    })
  }

  const isParticipant = conversation.participants.some(
    participantId => participantId.toString() === decodedToken.id
  )

  if (!isParticipant) {
    return res.status(403).json({
      error: 'not allowed to access this conversation'
    })
  }

  const message = await Message.findOne({
    _id: req.params.messageId,
    conversation: conversation._id
  })
  if (!message) {
    return res.status(404).json({
      error: 'message not found'
    })
  }

  if (message.user.toString() !== decodedToken.id) {
    return res.status(403).json({
      error: 'not allowed to edit this message'
    })
  }

  const content = req.body.content?.trim()

  if (!content) {
    return res.status(400).json({
      error: 'content missing'
    })
  }

  message.content = content
  const updatedMessage = await message.save()

  const io = req.app.get('io')

  io.to(conversation.id).emit(
    'message:updated',
    updatedMessage.toJSON()
  )

  return res.json(updatedMessage)
})

conversationsRouter.delete('/:conversationId/messages/:messageId', async (req, res) => {
  const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)
  if (!decodedToken.id) {
    return res.status(401).json({
      error: 'token invalid'
    })
  }

  const conversation = await Conversation.findById(req.params.conversationId)
  if(!conversation) {
    return res.status(404).json({
      error: 'conversation not found'
    })
  }

  const isParticipant = conversation.participants.some(
    participantId => participantId.toString() === decodedToken.id
  )

  if (!isParticipant) {
    return res.status(403).json({
      error: 'not allowed to access this conversation'
    })
  }

  const message = await Message.findOne({
    _id: req.params.messageId,
    conversation: conversation._id
  })
  if (!message) {
    return res.status(404).json({
      error: 'message not found'
    })
  }

  if (message.user.toString() !== decodedToken.id) {
    return res.status(403).json({
      error: 'not allowed to delete this message'
    })
  }

  await Message.findByIdAndDelete(message._id)

  await User.findByIdAndUpdate(decodedToken.id, {
    $pull: { messages: message._id }
  })

  const io = req.app.get('io')

  io.to(conversation.id).emit(
    'message:deleted',
    message.id
  )

  return res.status(204).end()
})

module.exports = conversationsRouter
