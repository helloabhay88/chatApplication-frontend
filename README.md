# Socketmate Chat Frontend Client

*   **Live Application URL:** [https://socketmate.vercel.app/](https://socketmate.vercel.app/)

This repository houses the frontend client for the Socketmate real-time chat and WebRTC audio/video calling application. It is built as a single-page application using React, Vite, and Tailwind CSS.

## Features

- **Real-Time Private Messaging**: Send and receive private text messages instantly.
- **WebRTC Audio/Video Calling**: Native peer-to-peer calling featuring real-time signaling via WebSockets.
- **Media Device Configuration**: Custom preferences selector for camera and microphone inputs inside Settings.
- **Profile Customization**: Live updating display name and custom avatar uploads (with avatar deletion support).
- **Session Persistence**: Persistent session states using JSON Web Tokens (JWT) stored in LocalStorage.

## Tech Stack

- **Framework**: React (v19)
- **Build System**: Vite (v6)
- **Styling**: Tailwind CSS
- **WS Client**: Socket.io Client
- **Routing**: React Router DOM (v7)

## Getting Started

### Prerequisites
Ensure Node.js (v18+) is installed.

### Setup and Installation

1. Clone the repository and navigate to the directory:
   ```bash
   cd chatFront
   ```
2. Install the required packages:
   ```bash
   npm install
   ```
3. Configure your local environment in a `.env` file at the root of `chatFront/`:
   ```env
   VITE_API_URL=http://localhost:3000
   ```
4. Launch the local development server:
   ```bash
   npm run dev
   ```

## Detailed Documentation
For complete technical details, API listings, and project architecture configurations, refer to [DOCUMENTATION.md](DOCUMENTATION.md).
