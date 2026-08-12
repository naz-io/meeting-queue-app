# Meeting Queue

A real-time speaker queue for in-person meetings. One computer runs the meeting server; participant phones, the moderator, and the stage display connect to it over the same Wi-Fi network.

## Development

Install dependencies and start both the Socket.IO server and Vite:

```bash
npm install
npm run dev
```

Open the **Network** URL printed by Vite, for example:

```text
http://192.168.1.25:5173/?room=MEET-7892
```

Do not open the app as `localhost` when displaying the QR code; phones cannot reach `localhost` on the host computer.

The default moderator PIN is `7892`. Set a private PIN before real use:

```bash
MODERATOR_PIN=your-private-pin npm run dev
```

If the public URL cannot be inferred correctly, set it explicitly:

```bash
VITE_PUBLIC_URL=http://192.168.1.25:5173 MODERATOR_PIN=your-private-pin npm run dev
```

## Production-style LAN run

Build the React application, then serve it and Socket.IO from one port:

```bash
npm run build
MODERATOR_PIN=your-private-pin npm start
```

The server prints usable LAN URLs such as:

```text
http://192.168.1.25:3000/?room=MEET-7892
```

Keep the host computer awake and allow incoming Node connections through the firewall. Guest Wi-Fi networks may enable client isolation, which prevents devices from reaching the host.

Stop the server from its Terminal window with `Control+C`. Wait for `Meeting server stopped. Port released.` before closing the Terminal. The app handles shutdown signals and releases port 3000 before exiting.

## Rooms and views

- Participant: `/?room=MEET-7892`
- Stage display: `/?room=MEET-7892&view=stage`
- Moderator: open the participant URL, select **Moderator**, and enter the server PIN.

Meeting state is persisted to `server/data/meetings.json` and restored after a server restart. The server owns all queue changes and countdown timers; clients only send validated commands.

Participants must choose a name before their first connection to each room. Their room-specific name and avatar are stored locally and reused when they return from the same device.
