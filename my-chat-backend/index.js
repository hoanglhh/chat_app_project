const express = require('express')
const app = express()
const cors = require('cors')
const morgan = require('morgan')
require('dotenv').config()

app.use(cors())
app.use(express.json())

morgan.token('body', (req) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    return JSON.stringify(req.body)
  }

  return ''
})

app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms :body')
)

let messages = []

app.get('/api/messages', (req, res) => {
  res.json(messages)
})

app.get('/api/messages/:id', (req,res) => {
  const id = req.params.id
  const message = messages.find(message => message.id === id)

  if (message) {
    res.json(message)
  } else {
    res.status(404).end()
  }
})

app.delete('/api/messages/:id', (req,res) => {
  const id = req.params.id
  messages = messages.filter(message => message.id !== id)
  res.status(204).end()
})

const generateId = () => {
  const min = 1
  const max = 1000000
  const randomId = Math.floor(Math.random() * (max - min + 1)) + min
  return String(randomId)
}

app.post('/api/messages', (req,res) => {
  const body = req.body

  if (!body.name || !body.content || body.name.trim() === '' || body.content.trim() === '') {
    return res.status(400).json({
      error: 'name or content missing'
    })
  }

  const message = {
    id: generateId(),
    name: body.name.trim(),
    content: body.content.trim(),
    createdAt: new Date().toISOString(),
  }

  messages = messages.concat(message)

  res.status(201).json(message)
})

app.put('/api/messages/:id', (req,res) => {
  const id = req.params.id
  const body = req.body
  const message = messages.find(message => message.id === id)
  
  if (!message) {
    return res.status(404).end()
  }

  if (!body.content || body.content.trim() === '') {
    return res.status(400).json({
      error: 'content missing'
    })
  }

  const changedMessage = {
    ...message,
    content: body.content.trim(),
  }

  messages = messages.map(message => message.id === id ? changedMessage : message)
  res.status(200).json(changedMessage)
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

  next(error)
}

app.use(errorHandler)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})