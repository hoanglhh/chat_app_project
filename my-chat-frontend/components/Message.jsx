import { useState } from "react"

const Message = ({ message, handleDelete, handleEdit, saving }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(message.content)

  return (
    <li className="message">
      <strong>{message.name}</strong>
      {isEditing ? (
        <div className="message-body">
          <input
            value={editedContent}
            onChange={(event) => setEditedContent(event.target.value)}
          />
          <div className="message-actions">
            <button onClick={() => {
              if (editedContent.trim() === '') {
                return
              }
              
              handleEdit(message.id, editedContent).then(() => {
              setIsEditing(false)
              })
            }}
              disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>

            <button onClick={() => {
              setIsEditing(false)
              setEditedContent(message.content)
            }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
      <div className="message-body">
        <p>{message.content}</p>

        <div className="message-actions">
          <button onClick={() => {
            setIsEditing(true)
            setEditedContent(message.content)
          }}>
            Edit
          </button>

          <button onClick={() => handleDelete(message.id)}>
            Delete
          </button>
        </div>
      </div>
      )} 
      <small className="message-time">{new Date(message.createdAt).toLocaleString()}</small>
    </li>
  )
}

export default Message