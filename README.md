# Chat App

A responsive, realtime full-stack chat application. It supports private and group
conversations, secure message ownership, live updates with Socket.IO, and
Gemini-powered chat and conversation summaries.

## Live application

- Frontend: [chat-app-project-frontend-wmxo.onrender.com](https://chat-app-project-frontend-wmxo.onrender.com)
- Backend: [chat-app-project-mbq1.onrender.com](https://chat-app-project-mbq1.onrender.com)

The free Render services may take a short time to wake up after being inactive.

## Features

### Accounts and security

- Account registration and login
- Password hashing with bcrypt
- JWT authentication with session persistence in `localStorage`
- Server-side authorization for creating, editing, and deleting messages
- Message ownership based on user IDs rather than display names

### Conversations and messaging

- Direct conversations between two users
- Named group conversations with at least two invited members
- Invite additional people to an existing group
- Realtime conversation and message updates with Socket.IO
- Create, edit, and delete your own messages
- Enter to send and Shift + Enter for a new line
- Automatic scrolling, loading states, notifications, and responsive layout

### AI features

- A private Gemini conversation for each user
- AI replies that use recent conversation history as context
- Conversation summaries for catching up on recent messages
- Rate limiting for AI messages and summaries
- Graceful handling when Gemini is unavailable or its quota is exceeded

## Tech stack

### Frontend

- React 19 and Vite
- Axios
- Socket.IO Client
- Tailwind CSS

### Backend

- Node.js and Express
- MongoDB and Mongoose
- Socket.IO
- JSON Web Tokens and bcrypt
- Google Gen AI SDK
- express-rate-limit
- Morgan, CORS, and dotenv

### Testing

- Node.js test runner
- Supertest
- Separate MongoDB test database

## Architecture

```text
React + Vite frontend
        │
        ├── HTTP/JSON ──► Express API ──► MongoDB Atlas
        │                       │
        └── Socket.IO ◄─────────┘
                                │
                                └── Google Gemini API
```

The Express server verifies JWTs before protected operations. Messages belong
to both a user and a conversation. Socket.IO rooms keep message and group
updates scoped to the users and conversations that should receive them.

## Project structure

```text
chat_app_project/
├── my-chat-frontend/
│   ├── components/
│   ├── services/
│   └── src/
└── my-chat-backend/
    ├── controllers/
    ├── models/
    ├── services/
    ├── tests/
    └── utils/
```

## Running locally

### Prerequisites

- Node.js
- A MongoDB database
- A Gemini API key from Google AI Studio for the AI features

### 1. Clone the repository

```bash
git clone https://github.com/hoanglhh/chat_app_project.git
cd chat_app_project
```

### 2. Configure and start the backend

```bash
cd my-chat-backend
npm install
```

Create `my-chat-backend/.env`:

```env
MONGODB_URI=your_mongodb_connection_string
TEST_MONGODB_URI=your_separate_test_database_connection_string
SECRET=your_long_random_jwt_secret
GEMINI_API_KEY=your_google_ai_studio_key
PORT=3001
```

Generate a JWT secret with a command such as:

```bash
openssl rand -hex 32
```

Never commit the `.env` file. The test database must be separate because the
backend tests delete its contents.

Start the backend:

```bash
npm run dev
```

The API and Socket.IO server run at `http://localhost:3001`.

### 3. Configure and start the frontend

In another terminal:

```bash
cd my-chat-frontend
npm install
```

The frontend defaults to `http://localhost:3001`. To override it, create
`my-chat-frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3001
```

Then start Vite:

```bash
npm run dev
```

Open the local URL shown by Vite.

## Running checks

Backend integration tests:

```bash
cd my-chat-backend
npm test
```

Frontend lint and production build:

```bash
cd my-chat-frontend
npm run lint
npm run build
```

## API overview

Conversation routes require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/users` | Register an account |
| `POST` | `/api/login` | Log in and receive a JWT |
| `GET` | `/api/conversations` | List the current user's conversations |
| `POST` | `/api/conversations` | Start or retrieve a direct conversation |
| `POST` | `/api/conversations/group` | Create a group conversation |
| `POST` | `/api/conversations/:id/participants` | Invite members to a group |
| `POST` | `/api/conversations/ai` | Create or retrieve the user's Gemini conversation |
| `GET` | `/api/conversations/:id/messages` | Load a conversation's messages |
| `POST` | `/api/conversations/:id/messages` | Send a regular message |
| `POST` | `/api/conversations/:id/ai-messages` | Send a message to Gemini |
| `PUT` | `/api/conversations/:id/messages/:messageId` | Edit an owned message |
| `DELETE` | `/api/conversations/:id/messages/:messageId` | Delete an owned message |
| `POST` | `/api/conversations/:id/summary` | Summarize recent messages |

## Current limitations

- Group chats do not yet have admin roles, member removal, or a leave-group action.
- Messages are not end-to-end encrypted.
- Gemini features depend on external API availability and quota.
- Free hosting may introduce backend cold starts after inactivity.

## Background

This project began as a React CRUD exercise using `json-server`. It was later
expanded into a full-stack application with Express, MongoDB, authentication,
authorization, realtime communication, integration tests, deployment, and AI
features.
