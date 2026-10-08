import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

// In-memory state. Fine for a demo; swap for Redis if you ever run
// more than one server process (Socket.io needs a shared adapter then).
const rooms = new Map();     // roomName -> Map<socketId, { username, color }>
const roomMeta = new Map();  // roomName -> { description, password, maxUsers, createdBy, createdAt }

const USER_COLORS = [
  "#F97362", "#4C9F70", "#3E7CB1", "#B4694C",
  "#8A5FBF", "#C79A3E", "#5A9E9E", "#B85C9E",
];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

function getRoomUsers(room) {
  const members = rooms.get(room);
  if (!members) return [];
  return Array.from(members.values());
}

function publicRoomMeta(room) {
  const meta = roomMeta.get(room);
  if (!meta) return null;
  return {
    room,
    description: meta.description || "",
    isPrivate: !!meta.password,
    maxUsers: meta.maxUsers,
    memberCount: rooms.get(room)?.size || 0,
  };
}

function cleanupIfEmpty(room) {
  if (rooms.get(room)?.size === 0) {
    rooms.delete(room);
    roomMeta.delete(room);
  }
}

app.get("/health", (_req, res) => res.json({ status: "ok", rooms: rooms.size }));

// Handy for debugging / a lobby view outside of sockets.
app.get("/rooms", (_req, res) => {
  const list = Array.from(roomMeta.keys())
    .map(publicRoomMeta)
    .filter((r) => !r.isPrivate);
  res.json(list);
});

io.on("connection", (socket) => {
  let currentRoom = null;
  let currentUser = null;

  function leaveCurrentRoom(reason) {
    if (!currentRoom) return;
    socket.leave(currentRoom);
    rooms.get(currentRoom)?.delete(socket.id);
    socket.to(currentRoom).emit("message:system", {
      id: crypto.randomUUID(),
      text: `${currentUser?.username} ${reason}.`,
      at: Date.now(),
    });
    io.to(currentRoom).emit("room:users", getRoomUsers(currentRoom));
    cleanupIfEmpty(currentRoom);
    currentRoom = null;
    currentUser = null;
  }

  socket.on("room:list", (_payload, ack) => {
    const list = Array.from(roomMeta.keys())
      .map(publicRoomMeta)
      .filter((r) => !r.isPrivate);
    ack?.({ ok: true, rooms: list });
  });

  // Explicit creation: fails if the room name is already taken.
  socket.on("room:create", ({ room, username, password, maxUsers, description }, ack) => {
    room = (room || "").trim().slice(0, 40);
    username = (username || "").trim().slice(0, 24) || `Guest-${socket.id.slice(0, 4)}`;
    description = (description || "").trim().slice(0, 140);
    password = (password || "").trim().slice(0, 64);
    const cap = Math.min(Math.max(parseInt(maxUsers, 10) || 20, 2), 100);

    if (!room) {
      ack?.({ ok: false, error: "Room name is required." });
      return;
    }
    if (roomMeta.has(room)) {
      ack?.({ ok: false, error: `"${room}" already exists. Join it instead, or pick another name.` });
      return;
    }

    roomMeta.set(room, {
      description,
      password: password || null,
      maxUsers: cap,
      createdBy: username,
      createdAt: Date.now(),
    });
    rooms.set(room, new Map());

    if (currentRoom) leaveCurrentRoom("left the room");

    currentRoom = room;
    currentUser = { username, color: colorForName(username) };
    rooms.get(room).set(socket.id, currentUser);
    socket.join(room);

    ack?.({
      ok: true,
      room,
      username,
      users: getRoomUsers(room),
      meta: publicRoomMeta(room),
    });

    io.to(room).emit("room:users", getRoomUsers(room));
  });

  // Join an existing room only — will not create one implicitly.
  socket.on("room:join", ({ room, username, password }, ack) => {
    room = (room || "").trim().slice(0, 40);
    username = (username || "").trim().slice(0, 24) || `Guest-${socket.id.slice(0, 4)}`;

    if (!room) {
      ack?.({ ok: false, error: "Room name is required." });
      return;
    }
    const meta = roomMeta.get(room);
    if (!meta) {
      ack?.({ ok: false, error: `"${room}" doesn't exist yet. Create it instead.` });
      return;
    }
    if (meta.password && meta.password !== (password || "").trim()) {
      ack?.({ ok: false, error: "Wrong password for this room." });
      return;
    }
    if ((rooms.get(room)?.size || 0) >= meta.maxUsers) {
      ack?.({ ok: false, error: `"${room}" is full (${meta.maxUsers} max).` });
      return;
    }

    if (currentRoom) leaveCurrentRoom("left the room");

    currentRoom = room;
    currentUser = { username, color: colorForName(username) };
    rooms.get(room).set(socket.id, currentUser);
    socket.join(room);

    ack?.({
      ok: true,
      room,
      username,
      users: getRoomUsers(room),
      meta: publicRoomMeta(room),
    });

    socket.to(room).emit("message:system", {
      id: crypto.randomUUID(),
      text: `${username} joined the room.`,
      at: Date.now(),
    });

    io.to(room).emit("room:users", getRoomUsers(room));
  });

  socket.on("room:leave", () => leaveCurrentRoom("left the room"));

  socket.on("message:send", (text) => {
    if (!currentRoom || !currentUser) return;
    text = String(text || "").trim().slice(0, 2000);
    if (!text) return;

    io.to(currentRoom).emit("message:new", {
      id: crypto.randomUUID(),
      text,
      username: currentUser.username,
      color: currentUser.color,
      at: Date.now(),
    });
  });

  socket.on("typing:start", () => {
    if (!currentRoom || !currentUser) return;
    socket.to(currentRoom).emit("typing:update", { username: currentUser.username, typing: true });
  });

  socket.on("typing:stop", () => {
    if (!currentRoom || !currentUser) return;
    socket.to(currentRoom).emit("typing:update", { username: currentUser.username, typing: false });
  });

  socket.on("disconnect", () => leaveCurrentRoom("disconnected"));
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`micro-chat server listening on http://localhost:${PORT}`);
});
