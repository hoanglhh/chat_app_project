const bcrypt = require('bcrypt')
const loginRouter = require('express').Router()
const User = require('../models/user')
const loginResponse = require('../utils/loginResponse')
const { getTrimmedText } = require('../utils/validation')
const { loginLimiter } = require('../utils/authLimiters')

loginRouter.post('/', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {}

  const trimmedUsername = getTrimmedText(username)

  if (
    !trimmedUsername || typeof password !== 'string' || !password
  ) {
    return res.status(401).json({
      error: 'invalid username or password'
    })
  }

  const user = await User.findOne({ username: trimmedUsername })
  const passwordCorrect = user === null || !user.passwordHash
    ? false
    : await bcrypt.compare(password, user.passwordHash)

  if (!(user && passwordCorrect)) {
    return res.status(401).json({
      error: 'invalid username or password'
    })
  }

  res.set('Cache-Control', 'no-store').status(200).json(loginResponse(user))
})

module.exports = loginRouter
