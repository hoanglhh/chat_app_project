const conversationsRouter = require('express').Router()
const Conversation = require('../models/conversation')
const User = require('../models/user')
const jwt = require('jsonwebtoken')
const config = require('../utils/config')

const getTokenFrom = req => {
  const authorization = req.get('authorization')

  if (authorization?.startsWith('Bearer ')) {
    return authorization.replace('Bearer ', '')
  }

  return null
}

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

module.exports = conversationsRouter