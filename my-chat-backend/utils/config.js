require('dotenv').config()

const PORT = process.env.PORT || 3001
const MONGODB_URI = process.env.NODE_ENV === 'test'
  ? process.env.TEST_MONGODB_URI
  : process.env.MONGODB_URI
const SECRET = process.env.SECRET
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL } = process.env

module.exports = { PORT, MONGODB_URI, SECRET, GEMINI_API_KEY,
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL }
