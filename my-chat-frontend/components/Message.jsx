const Message = ({ message, handleDelete, handleEdit }) => {

  return (
    <li>
      <strong>{message.name}</strong>
      <br />
      {message.content} 
      <button onClick={() => handleDelete(message.id)}>
        Delete</button>
      <button onClick={() => handleEdit(message.id)}>Edit</button>
      <br />
      <small>{new Date(message.createdAt).toLocaleString()}</small>
    </li>
  )
}

export default Message