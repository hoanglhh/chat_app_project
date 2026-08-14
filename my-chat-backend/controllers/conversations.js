const conversationsRouter = require('express').Router()
const Conversation = require('../models/conversation')
const User = require('../models/user')
const jwt = require('jsonwebtoken')
const config = require('../utils/config')
const logger = require('../utils/logger')
const Message = require('../models/message')
const { summarizeMessages, generateAiReply } = require('../services/gemini')
const { rateLimit } = require('express-rate-limit')

const getTokenFrom = req => {
  const authorization = req.get('authorization')

  if (authorization?.startsWith('Bearer ')) {
    return authorization.replace('Bearer ', '')
  }

  return null
}

const authenticateGeminiRequest = (req, res, next) => {
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

const aiMessageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req => req.decodedToken.id,
  message: {
    error: 'Too many AI messages. Please try again in 10 minutes.'
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

conversationsRouter.post('/group', async (req, res) => {
  const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)

  if (!decodedToken.id) {
    return res.status(401).json({
      error: 'token invalid'
    })
  }

  const name = req.body.name?.trim()
  const { participantIds } = req.body

  if (!name) {
    return res.status(400).json({
      error: 'group name is required'
    })
  }

  if (
    !Array.isArray(participantIds) ||
    participantIds.length < 2 ||
    participantIds.some(
      participantId =>
        typeof participantId !== 'string' || !participantId.trim()
    )
  ) {
    return res.status(400).json({
      error: 'select at least two group members'
    })
  }

  const uniqueParticipantIds = [
    ...new Set(participantIds.map(participantId => participantId.trim()))
  ].filter(participantId => participantId !== decodedToken.id)

  if (uniqueParticipantIds.length < 2) {
    return res.status(400).json({
      error: 'select at least two other group members'
    })
  }

  const participants = await User.find({
    _id: { $in: uniqueParticipantIds }
  })

  if (participants.length !== uniqueParticipantIds.length) {
    return res.status(404).json({
      error: 'one or more users were not found'
    })
  }

  const conversation = new Conversation({
    type: 'group',
    name,
    participants: [decodedToken.id, ...uniqueParticipantIds],
    createdBy: decodedToken.id
  })

  const savedConversation = await conversation.save()
  await savedConversation.populate('participants', 'username name')

  const io = req.app.get('io')

  uniqueParticipantIds.forEach(participantId => {
    io.to(`user:${participantId}`).emit(
      'conversation:created',
      savedConversation.toJSON()
    )
  })

  return res.status(201).json(savedConversation)
})

conversationsRouter.post(
  '/:conversationId/participants',
  async (req, res) => {
    const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)

    if (!decodedToken.id) {
      return res.status(401).json({
        error: 'token invalid'
      })
    }

    const conversation = await Conversation.findById(
      req.params.conversationId
    )

    if (!conversation) {
      return res.status(404).json({
        error: 'conversation not found'
      })
    }

    if (conversation.type !== 'group') {
      return res.status(400).json({
        error: 'members can only be added to group conversations'
      })
    }

    const isParticipant = conversation.participants.some(
      participantId =>
        participantId.toString() === decodedToken.id
    )

    if (!isParticipant) {
      return res.status(403).json({
        error: 'not allowed to invite members to this group'
      })
    }

    const { participantIds } = req.body

    if (
      !Array.isArray(participantIds) ||
      participantIds.length === 0 ||
      participantIds.some(
        participantId =>
          typeof participantId !== 'string' || !participantId.trim()
      )
    ) {
      return res.status(400).json({
        error: 'select at least one user to invite'
      })
    }

    const existingParticipantIds = new Set(
      conversation.participants.map(participantId => participantId.toString())
    )
    const newParticipantIds = [
      ...new Set(participantIds.map(participantId => participantId.trim()))
    ].filter(participantId => !existingParticipantIds.has(participantId))

    if (newParticipantIds.length === 0) {
      return res.status(400).json({
        error: 'selected users are already group members'
      })
    }

    const newParticipants = await User.find({
      _id: { $in: newParticipantIds }
    })

    if (newParticipants.length !== newParticipantIds.length) {
      return res.status(404).json({
        error: 'one or more users were not found'
      })
    }

    conversation.participants.push(...newParticipantIds)
    await conversation.save()
    await conversation.populate('participants', 'username name')

    const updatedConversation = conversation.toJSON()
    const io = req.app.get('io')

    conversation.participants.forEach(participant => {
      io.to(`user:${participant.id}`).emit(
        'conversation:updated',
        updatedConversation
      )
    })

    return res.json(updatedConversation)
  }
)

conversationsRouter.post('/ai', async (req, res) => {
  const decodedToken = jwt.verify(
    getTokenFrom(req),
    config.SECRET
  )

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

  const existingConversation = await Conversation
    .findOne({
      type: 'ai',
      createdBy: user._id
    })
    .populate('participants', 'username name')

  if (existingConversation) {
    return res.status(200).json(existingConversation)
  }

  const conversation = new Conversation({
    type: 'ai',
    name: 'Gemini',
    participants: [user._id],
    createdBy: user._id
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
  authenticateGeminiRequest,
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

conversationsRouter.post(
  '/:conversationId/ai-messages',
  authenticateGeminiRequest,
  aiMessageLimiter,
  async (req, res) => {
    const decodedToken = req.decodedToken

    const user = await User.findById(decodedToken.id)

    if (!user) {
      return res.status(401).json({
        error: 'user missing or invalid'
      })
    }

    const conversation = await Conversation.findById(
      req.params.conversationId
    )

    if (!conversation) {
      return res.status(404).json({
        error: 'conversation not found'
      })
    }

    if (
      conversation.type !== 'ai' ||
      conversation.createdBy.toString() !== decodedToken.id
    ) {
      return res.status(403).json({
        error: 'not allowed to use this AI conversation'
      })
    }

    const content = req.body.content?.trim()

    if (!content) {
      return res.status(400).json({
        error: 'content missing'
      })
    }

    const userMessage = await new Message({
      name: user.name || user.username,
      content,
      role: 'user',
      user: user._id,
      conversation: conversation._id
    }).save()

    user.messages = user.messages.concat(userMessage._id)
    await user.save()

    const io = req.app.get('io')

    io.to(conversation.id).emit(
      'message:created',
      userMessage.toJSON()
    )

    const history = await Message
      .find({ conversation: conversation._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    history.reverse()

    let reply

    try {
      reply = await generateAiReply(history)
    } catch (error) {
      logger.error('Gemini failed to generate a reply:', error.message)

      return res.status(502).json({
        error: 'Gemini could not reply. Your message was still saved.',
        userMessage: userMessage.toJSON()
      })
    }

    const assistantMessage = await new Message({
      name: 'Gemini',
      content: reply,
      role: 'assistant',
      conversation: conversation._id
    }).save()

    io.to(conversation.id).emit(
      'message:created',
      assistantMessage.toJSON()
    )

    return res.status(201).json({
      userMessage,
      assistantMessage
    })
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

  if (conversation.type === 'ai') {
    return res.status(400).json({
      error: 'use the AI message endpoint for this conversation'
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

  if (
    message.role === 'assistant' ||
    message.user?.toString() !== decodedToken.id
  ) {
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

  if (
    message.role === 'assistant' ||
    message.user?.toString() !== decodedToken.id
  ) {
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
