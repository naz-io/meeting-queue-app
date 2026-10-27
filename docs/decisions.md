# Product and design decisions

This file records the decisions that shape Meeting Queue: what was chosen, why, and what it costs. Each entry is short on purpose. When a decision changes, edit its entry and say what replaced it, rather than deleting it.

## Product

### P1. One laptop runs the meeting; no cloud, no accounts

**Decision.** A single computer on the meeting's Wi-Fi runs the server. Phones, the moderator screen and the stage display all connect to it. Nobody signs up or installs anything.

**Why.** In-person meetings need something that works in five minutes with a QR code, keeps attendee names off third-party services, and does not depend on internet access.

**Cost.** The host computer must stay awake and reachable. Guest Wi-Fi networks that isolate devices block it. There is one server per meeting venue, not a hosted service.

### P2. Three roles, one link

**Decision.** Everyone opens the same room link. Participants raise and lower their hand, the moderator unlocks controls with a PIN, and `&view=stage` turns any screen into a display for the room.

**Why.** One QR code is easier to share than three links, and the moderator can switch roles on their own device.

**Cost.** Anyone with the link can open the stage view; it only shows what the room already sees on the projector.

### P3. A short transition buffer before each speaker

**Decision.** Calling a speaker starts a countdown (10 seconds by default; 0, 5, 10, 15 or 30 from the settings) before their speaking time begins. The moderator can start immediately or cancel and put the person back at the front of the queue.

**Why.** People need a moment to reach the microphone, and their speaking time should not start while they walk.

### P4. The moderator decides who a new speaking time applies to

**Decision.** Changing the default speaking time asks whether it applies to everyone already waiting or only to people who raise their hand from now on. Whoever is speaking, or already called during the buffer, keeps their time.

**Why.** Both are common in real meetings ("we are running late, everyone gets one minute" versus "new rule from here on"), and changing a running speaker's time without asking would feel unfair.

### P5. Fairness information in front of the moderator

**Decision.** The queue shows how long each person has already spoken and how many turns they have had, with a "First Turn" badge for newcomers. The history tab totals each person's time and exports to CSV.

**Why.** Moderators want to spread the floor fairly without keeping notes by hand.

**Details.** Totals are matched by participant ID, so two people with the same name stay separate. Older history entries saved without an ID fall back to matching by name.

### P6. Auto-advance is optional

**Decision.** When enabled, the next person is called 1.2 seconds after a speaker's time runs out. It is off by default, and turning it off cancels a hand-off already counting down.

**Why.** Some meetings want strict timing; most want the moderator to decide.

### P7. Sound only where the room hears it

**Decision.** The ten-second warning chime and the time-up alert play on the moderator and stage screens. Participants' phones stay quiet. The "pop" feedback plays only for the moderator's own actions.

**Why.** Twenty phones chiming at once is noise; the room already hears the stage screen.

### P8. Participants keep their place, not an account

**Decision.** Each device gets a random participant ID and secret token stored in the browser. A name and avatar are chosen per room and remembered on that device. The phone's back button asks before leaving the meeting.

**Why.** No sign-up, but a refresh or a dropped connection does not lose your place in line, and another device cannot act as you.

**Cost.** Clearing browser data creates a new identity. Names are not verified.

## Architecture

### A1. The server owns every change

**Decision.** Devices send commands (`raise-hand`, `start-speaker`, …). The server validates each one, applies it, and broadcasts the result to the room. Devices never change the queue locally.

**Why.** Every screen shows the same truth, and permission checks cannot be bypassed from the browser.

**Cost.** A device that is offline cannot act until it reconnects.

### A2. Meeting state is a JSON file

**Decision.** Rooms are saved to `server/data/meetings.json`. Saves are debounced by 500 ms, written to a temporary file and renamed into place, run one at a time, and flushed when the server stops.

**Why.** Meeting data is small, so a database would add setup with no benefit. Writing then renaming means a crash never leaves a half-written file.

**Cost.** Only one server may use a data folder at a time; two servers on the same folder overwrite each other.

### A3. Commands are a typed contract, validated by hand

**Decision.** `shared/protocol.ts` maps every command to its payload type, and `MeetingCommand` is derived from that map. `server/commands.ts` checks every incoming command field by field before the store sees it. `server/commandHandlers.ts` defines who may send each command and what it does.

**Why.** Client and server cannot drift apart without a compile error, and a new command cannot be added without a validator, a permission and a handler. Payloads are small, so hand-written checks were preferred over adding a validation library.

**Details.** Display text is trimmed and shortened; IDs and tokens that are too long are rejected rather than cut, so a long token cannot be shortened into a valid one.

### A4. Timers are end times; each device counts down itself

**Decision.** The server stores when a timer ends (`endsAt`) and broadcasts only when something changes hands: the buffer ends, time runs out, or auto-advance fires. Every message carries the server's clock time, and each device counts down locally, corrected by the difference between its clock and the server's.

**Why.** Broadcasting every second sent the whole room to every phone once a second, and a slow network made timers stutter. End times also survive a server restart.

**Cost.** A device shows the right time only after its first message from the server; until then a wrong device clock is not yet corrected.

### A5. History travels separately

**Decision.** Room updates carry everything except the speaker history. The history (up to 1,000 entries) is sent on its own, only when it changes, and in full when a device joins.

**Why.** Raising a hand should not resend the whole history to every device.

### A6. Only timer displays re-render every second

**Decision.** The live countdown lives in its own React context (`CountdownContext`), read only by the screens that show seconds. The main meeting context changes only when the server sends something, and its types leave out remaining time so a stale value cannot be read by mistake.

**Why.** With the countdown in the main context, the queue list and history table re-rendered every second for no reason.

### A7. Code shared by client and server lives in `shared/`

**Decision.** `shared/meeting.ts` (the meeting model), `shared/protocol.ts` (messages and commands) and `shared/roomCode.ts` (the room-code rule) are imported by both sides.

**Why.** Both sides apply exactly the same rules, and the server does not reach into the client's source folder.

## Security and limits

### S1. One moderator PIN per server, one token per sign-in

**Decision.** The PIN comes from `MODERATOR_PIN`. Under `npm run dev` it defaults to `7892`; under `npm start` without `MODERATOR_PIN` a random 6-digit PIN is generated and printed. Each successful sign-in gets its own token, valid for 12 hours. Only `HMAC(PIN, token)` and the expiry are saved, so the data file holds no usable token and changing the PIN signs everyone out.

**Why.** A shared PIN is the simplest thing a meeting host can hand to a co-moderator, and per-sign-in tokens let it be rotated.

**Cost.** One PIN covers every room on the server. Restarting with a newly generated PIN signs moderators out, so real meetings should set `MODERATOR_PIN`.

### S2. Wrong PINs lock the device out

**Decision.** Five wrong PINs from one address lock it for 30 seconds, doubling with each lockout up to five minutes. PINs are compared in constant time.

**Why.** A four- or six-digit PIN is otherwise guessable in seconds by anyone on the Wi-Fi.

### S3. Rooms and queues are bounded

**Decision.** Room codes are 4 to 24 letters, digits or dashes, case-insensitive; a malformed code shows an "Invalid room code" screen rather than opening a different room. Only joining can create a room. A server holds at most 50 rooms; rooms with nobody queued or speaking are removed after 24 hours without activity (`MEET-7892` is kept). A queue holds at most 200 people.

**Why.** Without limits, one script could create rooms or queue entries until the data file and memory grew without bound.
