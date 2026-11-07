const jwt = require('jsonwebtoken')
const config = require('./config')

const loginResponse = user => ({
  token: jwt.sign({ username: user.username, id: user.id }, config.SECRET, { expiresIn: 60 * 60 }),
  username: user.username,
  name: user.name,
  id: user.id
})

module.exports = loginResponse
