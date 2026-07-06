import Message from "./Message"

const MessageList = ({ messages, handleDelete, handleEdit }) => {
  return (
    <ul>
      {messages.map((message) => (
        <Message key={message.id} message={message} handleDelete={handleDelete}
        handleEdit={handleEdit}/>
      ))}
    </ul>
  )
}

export default MessageList