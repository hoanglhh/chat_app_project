const bcrypt = require('bcrypt')
const usersRouter = require('express').Router()
const User = require('../models/user')

usersRouter.post('/', async (req, res) => {
  const { username, name, password } = req.body
  const trimmedUsername = username?.trim()

  if (!trimmedUsername || !password) {
    return res.status(400).json({
      error: 'username and password are required'
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
    name,
    passwordHash,
  })

  const savedUser = await user.save()

  res.status(201).json(savedUser)
})

usersRouter.get('/', async (req, res) => {
  const users = await User.find({})
  res.json(users)
})

module.exports = usersRouter