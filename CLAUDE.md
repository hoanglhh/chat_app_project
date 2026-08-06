# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack chat app built from Full Stack Open exercises. No authentication — message ownership is determined client-side by comparing `message.name` against the `localStorage` "chatName" value.

## Project Structure

```
chat_app_project/
├── my-chat-backend/          # Express + Mongoose API
│   ├── index.js              # All routes, middleware, and server startup
│   └── models/message.js     # Mongoose model + MongoDB connection
└── my-chat-frontend/        # React + Vite SPA
    ├── src/
    │   ├── App.jsx           # Root component, owns all state
    │   ├── main.jsx          # Entry point
    │   └── index.css
    ├── components/           # UI components (flat, no subdirectories)
    │   ├── Message.jsx
    │   ├── MessageList.jsx
    │   ├── MessageForm.jsx
    │   └── Notification.jsx
    └── services/messages.js  # Axios API layer
```

## Commands

### Backend (`my-chat-backend/`)

```bash
npm run dev      # Start with --watch (nodemon-like)
npm start        # Production start
```

Requires `.env` with `MONGODB_URI` and `PORT=3001`.

### Frontend (`my-chat-frontend/`)

```bash
npm run dev      # Vite dev server (port shown in terminal)
npm run build    # Production build → dist/
npm run lint     # ESLint
npm run preview  # Preview the production build locally
```

The frontend reads `VITE_API_BASE_URL` from `.env.local` (defaults to `http://localhost:3001/api/messages`).

## Tech Stack

- **Backend**: Express 5, Mongoose 9, Morgan (logging), CORS, dotenv, CommonJS (`require`)
- **Frontend**: React 19, Vite 8, Tailwind CSS v4 (via `@tailwindcss/vite`), Axios, DaisyUI 5, ESM (`import`), flat ESLint config

## API Design

All endpoints under `/api/messages`:

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/` | — | `Message[]` |
| GET | `/:id` | — | `Message` or 404 |
| POST | `/` | `{ name, content }` | `201 Message` |
| PUT | `/:id` | `{ content }` | `Message` or 404 |
| DELETE | `/:id` | — | `204` or error |

The backend validates required fields and returns `{ error: "..." }` with a 4xx status on failure.

## Data Model

`Message` (Mongoose):
- `_id` (auto) → serialized as `id` in API responses
- `name: String` (required)
- `content: String` (required)
- `createdAt: Date` (default `Date.now`)
- `_id` and `__v` are stripped from JSON responses

## Key Patterns

- **State ownership**: `App.jsx` holds all state (`messages`, `name`, `content`, `editingMessageId`, loading flags). Child components are pure/presentational.
- **API layer**: `services/messages.js` wraps Axios calls and returns `response.data` — no raw axios responses leak into components.
- **Message ownership**: `Message.jsx` compares `message.name === currentName.trim()` client-side to determine if the current user "owns" the message (shows edit/delete menu, right-aligns bubble).
- **No backend lint configured**: `my-chat-backend/package.json` has a no-op lint script.

## Environment Variables

Backend (`my-chat-backend/.env`):
- `MONGODB_URI` — MongoDB connection string
- `PORT` — server port (default `3001`)

Frontend (`my-chat-frontend/.env.local`):
- `VITE_API_BASE_URL` — full API base URL (e.g. `http://localhost:3001/api/messages`)
