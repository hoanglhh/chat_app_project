const messagesRouter = require('express').Router()
const Message = require('../models/message')

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

messagesRouter.delete('/:id', (req,res, next) => {
  Message.findByIdAndDelete(req.params.id)
    .then(() => {
      res.status(204).end()
    })
    .catch(next)
})

messagesRouter.post('/', (req,res, next) => {
  const body = req.body

  if (!body.name || !body.content || body.name.trim() === '' || body.content.trim() === '') {
    return res.status(400).json({
      error: 'name or content missing'
    })
  }

  const message = new Message ({
    name: body.name.trim(),
    content: body.content.trim(),
  })

  message.save()
    .then(savedMessage => {res.status(201).json(savedMessage)})
    .catch(next)
})

messagesRouter.put('/:id', (req,res, next) => {
  const body = req.body

  if (!body.content || body.content.trim() === '') {
    return res.status(400).json({
      error: 'content missing'
    })
  }

  Message.findByIdAndUpdate(req.params.id,
    { content: body.content },
    { returnDocument: 'after', runValidators: true }
  )
    .then(updatedMessage => {
      if (updatedMessage) {
        res.json(updatedMessage)
      } else {
        res.status(404).end()
      }
    })
    .catch(next)
}) 

module.exports = messagesRouter