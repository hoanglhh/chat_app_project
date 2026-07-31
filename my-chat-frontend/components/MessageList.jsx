import Message from "./Message"

const MessageList = ({ messages, handleDelete, currentName, startEditing }) => {
  return (
    <ul className="space-y-5" aria-label="Messages">
      {messages.map((message) => (
        <Message 
          key={message.id}
          message={message}
          handleDelete={handleDelete}
          currentName={currentName}
          startEditing={startEditing}
        />
      ))}
    </ul>
  )
}

export default MessageList
