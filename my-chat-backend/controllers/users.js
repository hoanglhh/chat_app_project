const bcrypt = require('bcrypt')
const usersRouter = require('express').Router()
const User = require('../models/user')
const { authenticateUser } = require('../utils/middleware')
const { getTrimmedText } = require('../utils/validation')
const { registrationLimiter } = require('../utils/authLimiters')

usersRouter.post('/', registrationLimiter, async (req, res) => {
  const { username, name, password } = req.body || {}
  const trimmedUsername = getTrimmedText(username)
  const trimmedName = getTrimmedText(name)

  if (!trimmedUsername || !trimmedName || typeof password !== 'string' || !password) {
    return res.status(400).json({
      error: 'name, username and password are required'
    })
  }

  if (trimmedUsername.length > 100 || trimmedName.length > 100) {
    return res.status(400).json({
      error: 'name and username must be at most 100 characters'
    })
  }

  if (Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({
      error: 'password must be at most 72 UTF-8 bytes'
    })
  }

  if (trimmedUsername.length < 3 || password.length < 3) {
    return res.status(400).json({
      error: 'username and password must be at least 3 characters'
    })
  }

  const saltRounds = 10
  const passwordHash = await bcrypt.hash(password, saltRounds)

  const user = new User({
    username: trimmedUsername,
    name: trimmedName,
    passwordHash,
  })

  const savedUser = await user.save()

  res.status(201).json(savedUser)
})

usersRouter.get('/', authenticateUser, async (req, res) => {
  const users = await User.find({}).select('username name')
  res.json(users)
})

module.exports = usersRouter
