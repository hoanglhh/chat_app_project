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
- Optional Google sign-in using OAuth 2.0 and OpenID Connect
- Password hashing with bcrypt
- JWT authentication with session persistence in `localStorage`
- Server-side authorization for creating, editing, and deleting messages
- Message ownership based on user IDs rather than display names
- Per-IP limits on login attempts and registration

### Conversations and messaging

- Direct conversations between two users
- Named group conversations with at least two invited members
- Invite additional people to an existing group
- Realtime conversation and message updates with Socket.IO
- Create, edit, and delete your own messages
- Recent messages load in pages of 50, with older history available on request
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
- Google OAuth 2.0 / OpenID Connect (`openid-client`)
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
- A MongoDB Atlas cluster, database user, and network access entry for your
  current IP address
- A Gemini API key from Google AI Studio for AI replies and summaries

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

Create `my-chat-backend/.env` and set the values for your own Atlas cluster.
Use a separate database name for tests; backend tests delete all data in the
configured test database.

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER/chatApp
TEST_MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER/chatAppTest
SECRET=paste_a_long_random_jwt_secret_here
GEMINI_API_KEY=your_google_ai_studio_key
PORT=3001
```

Generate a JWT secret with a command such as:

```bash
openssl rand -hex 32
```

Replace `USERNAME`, `PASSWORD`, and `CLUSTER` with the database credentials
and cluster hostname from Atlas. URL-encode special characters in the database
password. `SECRET` is required for JWT login. `GEMINI_API_KEY` is needed for
AI replies and summaries; the rest of chat can be used without Gemini.

Never commit the `.env` file or share its values. The test database must be
separate because the backend tests delete its contents.

Start the backend:

```bash
npm run dev
```

The API and Socket.IO server use `http://localhost:3001`. Check the terminal
for a successful MongoDB connection; the server can print its listening message
even when the Atlas connection fails. If the connection fails, check the URI,
Atlas database user/password, and Atlas Network Access allowlist.

When deploying behind one trusted reverse proxy, set `TRUST_PROXY=1` in the
backend environment so rate limits use the client IP. Leave it unset or `0`
for direct connections. Login allows 20 failed attempts per IP per 15 minutes;
registration allows 30 requests. Successful logins do not consume the failed
login allowance. Limits are stored in memory per backend process; use a shared
rate-limit store before running multiple backend instances.

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

Google sign-in stays hidden until its four backend settings are configured.
The Google client secret belongs only in `my-chat-backend/.env`:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and
`FRONTEND_URL`. The local redirect URI is
`http://localhost:3001/api/auth/google/callback`, and the local frontend origin
is `http://localhost:5173`.

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

Frontend browser regression tests:

```bash
cd my-chat-frontend
npx playwright install chromium
npm test
```

To use an existing Chromium installation, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium` when running `npm test`.
Playwright starts the frontend automatically and uses API fixtures, so these
tests do not need MongoDB or a Gemini key. They cover chat switching, drafts,
pagination, scroll position, rate-limit errors, and AI error handling. Backend
tests also exercise real Socket.IO clients and simulate Gemini responses and
failures without calling the external API.

## API overview

User discovery and conversation routes require an
`Authorization: Bearer <token>` header. User discovery returns only each
user's ID, username, and display name.

New usernames, display names, and group names are limited to 100 characters.
Messages are limited to 10,000 characters. New passwords must be at least
3 characters and at most 72 UTF-8 bytes. Existing accounts can still log in
with their original credentials.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/users` | Register an account |
| `GET` | `/api/users` | Discover users (authentication required) |
| `POST` | `/api/login` | Log in and receive a JWT |
| `GET` | `/api/auth/google/config` | Check Google sign-in availability |
| `GET` | `/api/auth/google` | Start Google OpenID Connect sign-in |
| `GET` | `/api/auth/google/callback` | Validate Google's response and complete sign-in |
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

Message history returns `{ "messages": [...], "nextCursor": "..." }`, with
at most 50 messages in chronological order. Pass a non-null cursor as the
`before` query parameter to load an older page. A null cursor marks the end of
history. Cursors include the timestamp and ID, so concurrent arrivals and a
deleted boundary message do not shift later pages. Deploy the frontend and
backend together when upgrading from the previous array response format.

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
