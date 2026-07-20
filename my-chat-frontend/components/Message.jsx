import { useState } from "react"

const Message = ({ message, handleDelete, currentName, startEditing }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isOwnMessage = message.name === currentName

  return (
    <li className={`message ${isOwnMessage ? 'own' : 'other'}`}>
      <strong>{message.name}</strong>
    
      <div className="message-body">
        <p>{message.content}</p>
        
        {isOwnMessage && (
          <>
            <button className="menu-button" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              &#x22EE;
            </button>

            {isMenuOpen && (
              <div className="menu-dropdown"> 
                <div className="message-actions">

                  <button onClick={() => {
                    startEditing(message)
                    setIsMenuOpen(false)
                  }}>
                    Edit
                  </button>

                  <button onClick={() => {
                    handleDelete(message.id)
                    setIsMenuOpen(false)
                  }}>
                    Delete
                  </button>

                </div>
              </div>
            )}        
          </>
        )}
      </div>
      <small className="message-time">{new Date(message.createdAt).toLocaleString()}</small>
    </li>
  )
}

export default Message