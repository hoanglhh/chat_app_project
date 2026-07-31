# Chat App

A responsive full-stack chat application built to practice concepts from [Full Stack Open](https://fullstackopen.com/). Users can create, edit, and delete messages through a React interface backed by an Express API and MongoDB.

## Live application

- Frontend: [chat-app-project-frontend-wmxo.onrender.com](https://chat-app-project-frontend-wmxo.onrender.com)
- API: [chat-app-project-mbq1.onrender.com/api/messages](https://chat-app-project-mbq1.onrender.com/api/messages)

Render's free services can take a short time to wake up after being inactive.

## Features

- Create and load messages
- Edit messages from the composer
- Delete messages
- Name persistence with `localStorage`
- Own and other message alignment
- Enter to send and Shift + Enter for a new line
- Loading, sending, saving, and error feedback
- Automatic scrolling to the latest message
- Responsive desktop and mobile layout

## Tech stack

### Frontend

- React
- Vite
- Axios
- Tailwind CSS

### Backend

- Node.js
- Express
- MongoDB and Mongoose
- Morgan
- CORS
- dotenv

## Project structure

```text
chat_app_project/
├── my-chat-frontend/
└── my-chat-backend/
```

## Running locally

### 1. Clone the repository

```bash
git clone https://github.com/hoanglhh/chat_app_project.git
cd chat_app_project
```

### 2. Start the backend

```bash
cd my-chat-backend
npm install
```

Create `my-chat-backend/.env`:

```env
MONGODB_URI=your_mongodb_connection_string
PORT=3001
```

Then start the development server:

```bash
npm run dev
```

The API runs at `http://localhost:3001/api/messages`.

### 3. Start the frontend

In another terminal:

```bash
cd my-chat-frontend
npm install
```

The frontend uses `http://localhost:3001/api/messages` by default. To override it, create `my-chat-frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3001/api/messages
```

Start Vite:

```bash
npm run dev
```

Open the local URL shown by Vite in your browser.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/messages` | Get all messages |
| `GET` | `/api/messages/:id` | Get one message |
| `POST` | `/api/messages` | Create a message |
| `PUT` | `/api/messages/:id` | Update a message |
| `DELETE` | `/api/messages/:id` | Delete a message |

## Current limitation

There is no authentication yet. The frontend treats a message as the current user's message when its name matches the name stored in the composer. This is suitable for learning UI behavior, but it is not secure ownership verification.
