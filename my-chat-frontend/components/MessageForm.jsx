const MessageForm = ({ name, content, addMessage, handleContentChange, handleNameChange, sending }) => {
  const cannotSend = sending || content.trim() === ''

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()        
      if (content.trim() === '' || sending) {
        return
      }
      event.currentTarget.form.requestSubmit()
    }
  }

  return (
    <form onSubmit={addMessage}>
      <div className="form-row">
        <label htmlFor="name">Name</label>
        <input 
        value={name}
        onChange={handleNameChange}
        />
      </div>

      <div className="form-row">
        <label htmlFor="content">Message</label>
        <textarea 
        value={content}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        />
      </div>
      <button type="submit" disabled={cannotSend}>
        {sending ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}

export default MessageForm