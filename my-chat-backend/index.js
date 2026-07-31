const express = require('express')
const app = express()
const cors = require('cors')
const morgan = require('morgan')
require('dotenv').config()

app.use(cors())
app.use(express.json())

const Message = require('./models/message')

morgan.token('body', (req) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    return JSON.stringify(req.body)
  }

  return ''
})

app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms :body')
)

app.get('/api/messages', (req, res, next) => {
  Message.find({})
    .then(messages => {
      res.json(messages)
    })
    .catch(next)
})

app.get('/api/messages/:id', (req,res, next) => {
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

app.delete('/api/messages/:id', (req,res, next) => {
  Message.findByIdAndDelete(req.params.id)
    .then(() => {
      res.status(204).end()
    })
    .catch(next)
})

app.post('/api/messages', (req,res, next) => {
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

app.put('/api/messages/:id', (req,res, next) => {
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

const unknownEndpoint = (req, res) => {
  res.status(404).json({
    error: 'unknown endpoint'
  })
}

app.use(unknownEndpoint)

const errorHandler = (error, req, res, next) => {
  console.error(error.message)

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'malformed JSON'
    })
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      error: 'malformatted id'
    })
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: error.message
    })
  }

  next(error)
}

app.use(errorHandler)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})