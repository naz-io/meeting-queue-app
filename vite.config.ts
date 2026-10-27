import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In development the page and the meeting server share one origin: Vite forwards Socket.IO
// (including the WebSocket upgrade) to the meeting server, so phones only need Vite's port.
const meetingServerPort = Number(process.env.MEETING_SERVER_PORT) || 3000
const proxy = {
  '/socket.io': { target: `http://localhost:${meetingServerPort}`, ws: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
})
