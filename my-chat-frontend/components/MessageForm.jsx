import { useState } from "react"

const MessageForm = ({ onCreate }) => {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()

    if (name.trim() === '' || content.trim() === '') {
      return
    }

    const messageObject = {
      name,
      content,
      createdAt: new Date().toISOString()
    }

    onCreate(messageObject)

    setName('')
    setContent('')
  }
  const handleNameChange = (event) => {
    setName(event.target.value)
  }
  
  const handleContentChange = (event) => {
    setContent(event.target.value)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        Name: <input 
        value={name}
        onChange={handleNameChange}
        />
      </div>
      <div>
        Message: <input 
        value={content}
        onChange={handleContentChange}
        />
      </div>
      <button type="submit">Send</button>
    </form>
  )
}

export default MessageForm
