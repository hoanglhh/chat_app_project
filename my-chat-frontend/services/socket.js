import { io } from 'socket.io-client'

const backendUrl = 
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3001'

const socket = io(backendUrl)

export default socket
