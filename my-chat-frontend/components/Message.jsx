const Message = ({ message }) => {
  return (
    <li>
      <strong>{message.name}</strong>
      <br />
      {message.content}
      <br />
      <small>{new Date(message.createdAt).toLocaleString()}</small>
    </li>
  )
}

export default Message
