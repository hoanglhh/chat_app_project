import { useState } from "react"
import MessageForm from "../components/MessageForm"
import MessageList from "../components/MessageList"

const App = () => {
  const [messages, setMessages] = useState([
    {
    id: 1,
    name: 'Ada',
    content: 'Hello!',
    createdAt: new Date().toISOString()
    }
  ])  
  
  const addMessage = (messageObject) => {

    setMessages(messages.concat({
      ...messageObject,
      id: messages.length + 1
    }))
  }

  
  return (
    <div>
      <h1>Chat App</h1>
      <MessageForm onCreate={addMessage} />
      <MessageList messages={messages} />
    </div>
  )
}

export default App
