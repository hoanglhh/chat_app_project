import Message from "./Message"

const MessageList = ({ messages, handleDelete, currentUserId, startEditing }) => {
  return (
    <ul className="space-y-5" aria-label="Messages">
      {messages.map((message) => (
        <Message 
          key={message.id}
          message={message}
          handleDelete={handleDelete}
          currentUserId={currentUserId}
          startEditing={startEditing}
        />
      ))}
    </ul>
  )
}

export default MessageList
