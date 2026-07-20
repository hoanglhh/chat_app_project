const MessageForm = ({ name, content, addMessage, handleContentChange, handleNameChange, sending, saving, isEditing, cancelEditing }) => {
  const cannotSend = sending || saving || content.trim() === ''

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()        
      if (content.trim() === '' || sending || saving) {
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
        {saving ? 
        'Saving...' 
        : sending
          ? 'Sending...'
          : isEditing
            ? 'Save'
            : 'Send'}
      </button>
      {isEditing && (
        <button
        type="button"
        onClick={cancelEditing}
        disabled={saving}
        >
        Cancel
      </button>
      )}
    </form>
  )
}

export default MessageForm