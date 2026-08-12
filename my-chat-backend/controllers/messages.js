const messagesRouter = require('express').Router()
const Message = require('../models/message')
const jwt = require('jsonwebtoken')
const config = require('../utils/config')
const User = require('../models/user')

const getTokenFrom = req => {
  const authorization = req.get('authorization')
  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.replace('Bearer ', '')
  }
  return null
}

messagesRouter.get('/', (req, res, next) => {
  Message.find({})
    .then(messages => {
      res.json(messages)
    })
    .catch(next)
})

messagesRouter.get('/:id', (req,res, next) => {
  Message.findById(req.params.id)
    .then(message => {
      if (message) {
        res.json(message)
      } else {
        res.status(404).end()
      }
    })
    .catch(next)
})

messagesRouter.delete('/:id', async (req,res, next) => {
  const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)
  if (!decodedToken.id) {
    return res.status(401).json({
      error: 'token invalid'
    })
  }

  const message = await Message.findById(req.params.id)
  if (!message) {
    return res.status(404).end()
  }

  if (message.user.toString() !== decodedToken.id) {
    return res.status(403).json({
      error: 'not allowed to delete this message'
    })
  }

  await Message.findByIdAndDelete(req.params.id)
    
  await User.findByIdAndUpdate(decodedToken.id, {
    $pull: { messages: message._id }
  })

  const io = req.app.get('io')
  io.emit('message:deleted', message.id)

  res.status(204).end()
})

messagesRouter.post('/', async (req,res, next) => {
  const body = req.body
  const io = req.app.get('io')

  const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)
  if (!decodedToken.id) {
    return res.status(401).json({ 
      error: 'token invalid' 
    })
  }

  const user = await User.findById(decodedToken.id)
  if (!user) {
    return res.status(401).json({ 
      error: 'UserId missing or invalid' 
    })
  }

  if (!body.content || body.content.trim() === '') {
    return res.status(400).json({
      error: 'content missing'
    })
  }

  const message = new Message ({
    name: user.name || user.username,
    content: body.content.trim(),
    user: user._id,
  })

  const savedMessage = await message.save()

  io.emit('message:created', savedMessage.toJSON())

  user.messages = user.messages.concat(savedMessage._id)
  await user.save()

  res.status(201).json(savedMessage)
})

messagesRouter.put('/:id', async (req,res, next) => {
  const body = req.body

  const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)
  if (!decodedToken.id) {
    return res.status(401).json({
      error: 'token invalid'
    })
  }

  const message = await Message.findById(req.params.id)
  if (!message) {
    return res.status(404).end()
  }

  if (message.user.toString() !== decodedToken.id) {
    return res.status(403).json({
      error: 'not allowed to edit this message'
    })
  }

  if (!body.content || body.content.trim() === '') {
    return res.status(400).json({
      error: 'content missing'
    })
  }
  
  message.content = body.content.trim()

  const updatedMessage = await message.save()

  const io = req.app.get('io')
  io.emit('message:updated', updatedMessage.toJSON())

  res.status(200).json(updatedMessage)
}) 

module.exports = messagesRouter