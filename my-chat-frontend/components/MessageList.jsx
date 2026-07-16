import Message from "./Message"

const MessageList = ({ messages, handleDelete, handleEdit, saving }) => {
  return (
    <ul>
      {messages.map((message) => (
        <Message key={message.id} message={message} handleDelete={handleDelete}
        handleEdit={handleEdit} saving={saving}/>
      ))}
    </ul>
  )
}

export default MessageList