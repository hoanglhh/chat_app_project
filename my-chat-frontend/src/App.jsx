import { useState, useEffect } from "react"
import MessageForm from "../components/MessageForm"
import MessageList from "../components/MessageList"
import messageService from '../services/messages'

const App = () => {
  const [messages, setMessages] = useState([]) 
  const [name, setName] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    messageService.getAll().then(initialMessages => setMessages(initialMessages))
  }, [])
  
  const addMessage = (event) => {
    event.preventDefault()

    if (name.trim() === '' || content.trim() === '') {
      return
    }

    const messageObject = {
      name,
      content,
      createdAt: new Date().toISOString(),
    }
    
    messageService
    .create(messageObject)
    .then(returnedMessage => {
      setMessages(messages.concat(returnedMessage))
      setName('')
      setContent('')
    })
  }

  const handleDelete = (id) => {
    if (window.confirm('Delete this message?')) {
      messageService
      .remove(id)
      .then(() => {
        setMessages(messages.filter(message => message.id !== id))
      })
    }
  }

  const handleNameChange = (event) => {
    setName(event.target.value)
  }
  
  const handleContentChange = (event) => {
    setContent(event.target.value)
  }

  const handleEdit = (id) => {
    const editMessage = messages.find(message => message.id === id)
    const newContent = window.prompt('Edit this message?', editMessage.content)
    const changedMessage = {
      ...editMessage,
      content: newContent
    }

    if (newContent === null) {
      return
    }

    if (newContent.trim() === '') {
      return
    }

    messageService
    .update(id, changedMessage)
    .then(returnedMessage => {
      setMessages(messages.map(message => message.id === id ? returnedMessage : message))
    })
  }
  
  return (
    <div>
      <h1>Chat App</h1>
      <MessageForm addMessage={addMessage} 
      name={name} content={content}
      handleContentChange={handleContentChange}
      handleNameChange={handleNameChange}/>
      <MessageList messages={messages} handleDelete={handleDelete} 
      handleEdit={handleEdit}/>
    </div>
  )
}

export default App
