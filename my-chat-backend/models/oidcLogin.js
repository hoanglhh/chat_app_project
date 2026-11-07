const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  stateHash: { type: String, required: true, unique: true },
  codeVerifier: { type: String, required: true },
  nonce: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
})

module.exports = mongoose.model('OidcLogin', schema)
