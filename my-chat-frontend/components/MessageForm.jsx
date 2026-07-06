const MessageForm = ({ name, content, addMessage, handleContentChange, handleNameChange }) => {

  return (
    <form onSubmit={addMessage}>
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