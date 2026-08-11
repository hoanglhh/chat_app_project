const RegisterForm = ({ username, name, password, setUsername, setName, setPassword, handleRegister}) => {
  return (
      <form onSubmit={handleRegister}>        
        <div>
          <label>
            Name
            <input
              type="text"
              value={name}
              onChange={({ target }) => setName(target.value)}
            />
          </label>
        </div>

        <div>
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={({ target }) => setUsername(target.value)}
            />
          </label>
        </div>

        <div>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={({ target }) => setPassword(target.value)}
            />
          </label>
        </div>
        <button type="submit">Register</button>
      </form>
  )
}

export default RegisterForm