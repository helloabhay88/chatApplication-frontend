# Project Documentation and Architecture Guide

*   **Live Application URL:** [https://socketmate.vercel.app/](https://socketmate.vercel.app/)

This document provides a comprehensive overview of the system architecture, directory structure, environment configuration, setup instructions, API endpoints, and WebSocket signaling mechanisms for the WebRTC Chat Application.

---

## Technical Stack and Dependencies

### Frontend (chatFront)
The frontend is a React-based Single Page Application (SPA) built using Vite.

*   **Core Framework**: React and React DOM (v19)
*   **Build Tool**: Vite (v6) for development hosting and production bundling.
*   **Styling**: Tailwind CSS and PostCSS for layout and design styles.
*   **Routing**: React Router DOM (v7) for client-side navigation.
*   **API Client**: Axios for managing HTTP requests to the Express backend.
*   **Real-time and Signaling**: Socket.io Client for real-time WebSocket messaging and WebRTC signaling.
*   **UI Utilities**: React Icons (interface icons) and React Spinners (loading indicators).

### Backend (chatServer)
The backend is a Node.js server running Express and a WebSocket server.

*   **HTTP Framework**: Express (v5) for REST API routing.
*   **Database ORM**: Mongoose for modeling and querying MongoDB documents.
*   **Real-time and Signaling**: Socket.io for managing bi-directional communication, online statuses, and WebRTC signaling.
*   **File Upload Handling**: Multer for processing multipart form data uploads.
*   **Cloud Storage**: Cloudinary and Multer Storage Cloudinary to store and serve user profile pictures.
*   **Security**:
    *   Bcrypt for password salting and hashing.
    *   JSON Web Token (JWT) for signing and verifying stateless user sessions.
*   **Email Delivery**: Nodemailer and SibApiV3Sdk (Brevo / Sendinblue) to dispatch verification OTP codes and recovery emails.
*   **Development Utility**: Nodemon for automatic server restarts during development.

---

## Application Workflows

### 1. Authentication and Security Flow
The system employs a token-based authentication mechanism backed by hashed credentials and token validation:

*   **Registration (`Register` controller)**:
    1.  The client sends `email`, `password`, and `name` via a multipart request.
    2.  The backend normalizes the email (trims and converts to lowercase) and verifies that it is unique.
    3.  The password is encrypted using Bcrypt with a salt factor of 10.
    4.  An account document containing the hashed password and optional avatar reference is saved to MongoDB.

*   **Authentication (`Login` controller)**:
    1.  The client transmits credentials via `POST /chat/user`.
    2.  The backend verifies the email and compares the plaintext password against the saved hash using `bcrypt.compare`.
    3.  Upon matching, a stateless JSON Web Token (JWT) is generated, signed using `process.env.JWT_KEY`, and configured with a 24-hour expiration window.
    4.  The token is returned to the client, which stores it in `LocalStorage` as `chat-token`.

*   **Session Authorization (`verifyUser` middleware)**:
    *   Protected API endpoints require clients to attach the token under the HTTP header: `Authorization: Bearer <token>`.
    *   The `verifyUser` middleware extracts the header, parses the token, and decodes the user's ID.
    *   If the header is missing, malformed, or if the token has expired/failed verification, the request is immediately rejected with an HTTP `401 Unauthorized` response to prevent request hanging.

*   **Password Reset Flow (`forgotPassword`, `resetPassword`, and `changePassword` controllers)**:
    1.  **Request**: The user requests a reset via email.
    2.  **Token Generation**: The server generates a temporary JWT token signed with a dynamic compound secret: `process.env.JWT_KEY + user.password`. This token is set to expire in 10 minutes.
    3.  **Security feature**: Because the compound secret is bound directly to the user's current hashed password, the generated token is automatically invalidated once the password changes, preventing link reuse.
    4.  **Verification & Redirect**: When the user clicks the reset link, the server verifies the token signature against the compound secret, and then redirects the client to the frontend reset password form (`/reset-password/:id/:token`).
    5.  **Change Password**: The user inputs a new password, which is hashed with Bcrypt and saved to MongoDB, immediately invalidating the active token.

*   **Session Persistence and Auto-Login**:
    1.  Upon successful login, the client stores the JWT session token in the browser's persistent `localStorage` (`chat-token`).
    2.  When the user reopens the application at the root path (`/`), the mounting hooks in `Home.jsx` check for the token's presence.
    3.  If found, a validation request is dispatched to `GET /chat/user/verify`. If verified successfully, the user is redirected to `/chat` immediately.
    4.  The session persists until the token expires (24-hour limit) or the user clicks logout (which executes `localStorage.removeItem('chat-token')`).

### 2. Live Chat and Messaging Flow
*   Selecting a contact from the sidebar fetches the conversation history via `GET /chat/message/read/:receiverId`.
*   Sending a message:
    1.  The client emits a `sendMessage` socket event to the server.
    2.  The server saves the message to MongoDB.
    3.  The server identifies if the recipient is connected (online) via active Socket maps.
    4.  If online, the server broadcasts a `newMessage` event to the recipient.
    5.  If offline, the unread count is updated.

### 3. User Profile and Settings Flow
*   **Profile Loading**: The client calls `GET /chat/user/me` with the bearer token to load user metadata.
*   **Profile Updating**: The client sends a request to `PUT /chat/user/profile` containing the display name and/or a new avatar file.
*   **Avatar Deletion**: Sending a `removeImage: 'true'` parameter requests the backend to set the database image field to an empty string, reverting the profile to a default letter avatar.

### 4. WebRTC Calling Flow
Real-time peer connections use a standard WebRTC negotiation flow via WebSockets:
1.  **Initiate Call**: The caller gets local media stream, initializes `RTCPeerConnection`, creates an SDP offer, and sends a `callUser` socket event.
2.  **Handle Offer**: The recipient receives the call invitation, gets their local media stream, initializes `RTCPeerConnection`, accepts the offer, creates an SDP answer, and sends an `answerCall` socket event.
3.  **P2P Negotiation**: Peers exchange ICE candidates via `iceCandidate` socket events to establish direct media channels.
4.  **Disconnect Call**: Sending an `endCall` event closes active tracks and cleanups the peer connection states.
*   **Media Preferences**: Users choose default video/audio inputs in the Devices settings, which is used during `getUserMedia` queries.

---

## Directory Structure

```
ChatApplication/
├── chatFront/                  # React Frontend (Vite)
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── SettingsModal.jsx # Settings view (profile, media devices)
│   │   │   └── Sidebar.jsx       # Sidebar containing users and active settings triggers
│   │   ├── pages/
│   │   │   ├── Chat.jsx          # Messaging interface and WebRTC call overlay
│   │   │   ├── Login.jsx         # Sign in screen
│   │   │   ├── Register.jsx      # Sign up screen
│   │   │   └── ForgotPassword.jsx# Password recovery request screen
│   │   ├── App.jsx               # Routes setup
│   │   └── main.jsx              # Application entry point
│   ├── .env                      # Frontend environment setup
│   ├── package.json              # Frontend dependency configurations
│   └── vite.config.js            # Vite configurations
│
└── chatServer/                 # Node/Express Backend
    ├── controllers/
    │   ├── authController.js     # Signup, verify, login, profile operations
    │   ├── messageController.js  # Messaging history and persistence
    │   └── userController.js     # User list directories
    ├── models/
    │   ├── user.js               # User MongoDB Schema
    │   └── message.js            # Message MongoDB Schema
    ├── Routes/
    │   ├── auth.js               # Authentication routes
    │   ├── message.js            # Message storage and retrieval routes
    │   └── user.js               # User metadata routes
    ├── socket/
    │   └── socket.js             # Socket server setup and connection maps
    ├── .env                      # Backend credentials and configuration
    ├── cloudinary.js             # Cloudinary configuration
    ├── index.js                  # Express setup and DB connection
    └── package.json              # Backend dependencies
```

---

## Environment Variables Configuration

Create the following files in their respective folders:

### 1. Frontend Environment (`chatFront/.env`)
```env
VITE_API_URL=http://localhost:3000
```

### 2. Backend Environment (`chatServer/.env`)
```env
PORT=3000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/chat-app
JWT_SECRET=your_jwt_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
BREVO_API_KEY=your_brevo_api_key
EMAIL_USER=your_sender_email@domain.com
```

---

## Local Installation and Setup

### Prerequisites
*   Node.js (v18+)
*   A running MongoDB instance

### 1. Backend Setup
Navigate to the `chatServer` folder, install the packages, and run the server:
```bash
cd chatServer
npm install
npm run start
```

### 2. Frontend Setup
Navigate to the `chatFront` folder, install the packages, and start the development server:
```bash
cd chatFront
npm install
npm run dev
```

---

## API Reference Guide

Protected endpoints require a Bearer token in the `Authorization` header.

### Authentication and User Endpoints
*   `POST /chat/user/register`: Registers a new user account, processes optional avatar file, and emails an OTP code.
*   `POST /chat/user`: Authenticates user credentials and returns user metadata and a signed JWT session token (Login).
*   `GET /chat/user/verify`: Validates JWT token state and returns active user authentication profile.
*   `POST /chat/user/forgot-verify`: Dispatches a password recovery email containing a reset link.
*   `GET /chat/user/:id/:token` or `GET /reset-password/:id/:token`: Verifies the password recovery token.
*   `POST /chat/user/:id/:token` or `POST /reset-password/:id/:token`: Saves a new password for the user.

### Profile and User Directories
*   `GET /chat/user/me`: Fetches the currently authenticated user's profile details.
*   `PUT /chat/user/profile`: Updates display name and/or avatar. Supports multipart form data uploads and a `removeImage: 'true'` parameter to clear avatars.
*   `GET /chat/users`: Retrieves the directory of all registered chat users.

### Message Logs
*   `GET /chat/message/read/:receiverId`: Retrieves the paginated message logs exchanged between the caller and target contact.
*   `POST /chat/message/send/:receiverId`: Persists and broadcasts a new text message payload.

---

## WebSocket Event Signaling

The server uses Socket.io to manage live message delivery, online visibility states, and WebRTC parameters:

### General Messaging Events
*   `connection`: Emitted upon connection.
*   `registerOnline`: Maps socket connection to user ID and broadcasts `onlineUsers` lists.
*   `sendMessage` / `newMessage`: Emits live text payloads between active client sockets.
*   `typing` / `stopTyping`: Indicates active typing indicators on the receiver's UI.

### WebRTC Connection Events
*   `callUser`: Distributes candidate media parameters and caller metadata.
*   `answerCall`: Transmits call acceptance state back to the initiating peer.
*   `iceCandidate`: Negotiates routing connections for WebRTC peer streams.
*   `endCall`: Triggers connection closing and resets media overlay status.
