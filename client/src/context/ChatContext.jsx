import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://sjvbgcrttkpnwiquejav.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdmJnY3J0dGtwbndpcXVlamF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE3NzEsImV4cCI6MjA5OTY3Nzc3MX0.ALe5eU3EHvQZGXSRb06aJ81Vo20qhNsl_ehNLdtEOPo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Persist just enough to restore the session on refresh. Password is only
// kept for rooms the person already unlocked this session — it's sent right
// back to joinRoom on reload rather than stored anywhere server-side twice.
const SESSION_KEY = "wire:session";
const NAME_KEY = "wire:displayName";

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveSession(room, username, password) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ room, username, password: password || "" }));
  } catch {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function loadSavedName() {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}
export function saveDisplayName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch {}
}

const ChatContext = createContext(null);

const initialState = {
  status: "connecting", // connecting | connected | disconnected
  room: null,
  roomMeta: null, // { description, isPrivate, maxUsers }
  username: null,
  messages: [],
  users: [],
  typingUsers: [],
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "STATUS":
      return { ...state, status: action.status };
    case "JOINED":
      return {
        ...state,
        room: action.room,
        roomMeta: action.meta,
        username: action.username,
        users: [],
        messages: [],
        error: null,
      };
    case "LEFT":
      return { ...initialState, status: "connected" };
    case "MESSAGES_SET":
      return { ...state, messages: action.messages };
    case "MESSAGE_APPEND":
      if (state.messages.some((m) => m.id === action.message.id)) return state;
      return { ...state, messages: [...state.messages, action.message] };
    case "USERS_UPDATE":
      return { ...state, users: action.users };
    case "TYPING_UPDATE": {
      const withoutUser = state.typingUsers.filter((u) => u !== action.username);
      return { ...state, typingUsers: action.typing ? [...withoutUser, action.username] : withoutUser };
    }
    case "ERROR":
      return { ...state, error: action.error };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

function colorForName(name) {
  const COLORS = ["#F97362", "#4C9F70", "#3E7CB1", "#B4694C", "#8A5FBF", "#C79A3E", "#5A9E9E", "#B85C9E"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const channelRef = useRef(null);
  const usernameRef = useRef(null);
  const colorRef = useRef(null);
  const roomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("rooms")
      .select("name", { count: "exact", head: true })
      .then(async ({ error }) => {
        if (cancelled) return;
        dispatch({ type: "STATUS", status: error ? "disconnected" : "connected" });
        if (!error) {
          const saved = loadSession();
          if (saved?.room && saved?.username) {
            await joinRoom(saved.room, saved.username, saved.password, { silent: true });
          }
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leaveChannel = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel) return;
    if (usernameRef.current && roomRef.current) {
      await supabase.from("messages").insert({
        room: roomRef.current,
        is_system: true,
        text: `${usernameRef.current} left the room.`,
      });
      await channel.untrack();
    }
    await supabase.removeChannel(channel);
    channelRef.current = null;
    roomRef.current = null;
  }, []);

  const enterRoom = useCallback(async (roomName, username, meta) => {
    usernameRef.current = username;
    colorRef.current = colorForName(username);
    roomRef.current = roomName;

    const { data: history } = await supabase
      .from("messages")
      .select("*")
      .eq("room", roomName)
      .order("at", { ascending: true })
      .limit(200);

    dispatch({ type: "JOINED", room: roomName, username, meta });
    dispatch({
      type: "MESSAGES_SET",
      messages: (history || []).map((m) => ({
        id: m.id,
        username: m.username,
        color: m.color,
        text: m.text,
        at: new Date(m.at).getTime(),
        system: m.is_system,
        attachmentUrl: m.attachment_url,
        attachmentType: m.attachment_type,
        attachmentName: m.attachment_name,
        attachmentSize: m.attachment_size,
      })),
    });

    const channel = supabase.channel(`room:${roomName}`, {
      config: { presence: { key: username }, broadcast: { self: false } },
    });

    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room=eq.${roomName}` }, (payload) => {
        const m = payload.new;
        dispatch({
          type: "MESSAGE_APPEND",
          message: {
            id: m.id,
            username: m.username,
            color: m.color,
            text: m.text,
            at: new Date(m.at).getTime(),
            system: m.is_system,
            attachmentUrl: m.attachment_url,
            attachmentType: m.attachment_type,
            attachmentName: m.attachment_name,
            attachmentSize: m.attachment_size,
          },
        });
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        dispatch({ type: "TYPING_UPDATE", username: payload.username, typing: payload.typing });
      })
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        const users = Object.values(presenceState)
          .flat()
          .map((p) => ({ username: p.username, color: p.color }));
        dispatch({ type: "USERS_UPDATE", users });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ username, color: colorRef.current });
        }
      });

    channelRef.current = channel;
  }, []);

  const createRoom = useCallback(async (roomName, username, options = {}) => {
    roomName = roomName.trim().slice(0, 40);
    username = (username || "").trim().slice(0, 24) || `Guest-${Math.random().toString(36).slice(2, 6)}`;
    const description = (options.description || "").trim().slice(0, 140);
    const password = (options.password || "").trim() || null;
    const maxUsers = Math.min(Math.max(parseInt(options.maxUsers, 10) || 20, 2), 100);

    const { error: insertError } = await supabase.from("rooms").insert({
      name: roomName,
      description,
      password,
      max_users: maxUsers,
      created_by: username,
    });

    if (insertError) {
      const msg = insertError.code === "23505"
        ? `"${roomName}" already exists. Join it instead, or pick another name.`
        : insertError.message;
      dispatch({ type: "ERROR", error: msg });
      return false;
    }

    await enterRoom(roomName, username, { description, isPrivate: !!password, maxUsers });
    saveSession(roomName, username, password);
    return true;
  }, [enterRoom]);

  const joinRoom = useCallback(async (roomName, username, password, opts = {}) => {
    const silent = !!opts.silent;
    roomName = roomName.trim().slice(0, 40);
    username = (username || "").trim().slice(0, 24) || `Guest-${Math.random().toString(36).slice(2, 6)}`;

    const { data: room, error: fetchError } = await supabase
      .from("rooms")
      .select("*")
      .eq("name", roomName)
      .maybeSingle();

    if (fetchError || !room) {
      if (silent) { clearSession(); return false; }
      dispatch({ type: "ERROR", error: `"${roomName}" doesn't exist yet. Create it instead.` });
      return false;
    }
    if (room.password && room.password !== (password || "").trim()) {
      if (silent) { clearSession(); return false; }
      dispatch({ type: "ERROR", error: "Wrong password for this room." });
      return false;
    }

    await enterRoom(roomName, username, {
      description: room.description,
      isPrivate: !!room.password,
      maxUsers: room.max_users,
    });

    if (!silent) {
      await supabase.from("messages").insert({ room: roomName, is_system: true, text: `${username} joined the room.` });
    }
    saveSession(roomName, username, password);
    return true;
  }, [enterRoom]);

  const listRooms = useCallback(async () => {
    const { data } = await supabase
      .from("rooms")
      .select("name, description, max_users, password")
      .order("created_at", { ascending: false })
      .limit(30);
    return (data || [])
      .filter((r) => !r.password)
      .map((r) => ({ room: r.name, description: r.description, maxUsers: r.max_users, memberCount: null }));
  }, []);

  const sendMessage = useCallback(async (text, attachment = null) => {
    text = String(text || "").trim().slice(0, 2000);
    if (!text && !attachment) return;
    if (!roomRef.current) return;
    await supabase.from("messages").insert({
      room: roomRef.current,
      username: usernameRef.current,
      color: colorRef.current,
      text,
      attachment_url: attachment?.url || null,
      attachment_type: attachment?.type || null,
      attachment_name: attachment?.name || null,
      attachment_size: attachment?.size || null,
    });
  }, []);

  // Uploads a file to the "attachments" storage bucket and returns a
  // {url, type, name, size} descriptor ready to pass into sendMessage.
  // Images get a distinct "image" type so the UI can render them inline
  // instead of as a generic download card.
  const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB — comfortably under the 10MB bucket limit
  const uploadAttachment = useCallback(async (file) => {
    if (!file || !roomRef.current) return { error: "No file selected." };
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return { error: `"${file.name}" is too large (max 8MB).` };
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${roomRef.current}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) {
      return { error: uploadError.message || "Upload failed." };
    }

    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
    return {
      attachment: {
        url: urlData.publicUrl,
        type: file.type.startsWith("image/") ? "image" : "file",
        name: file.name,
        size: file.size,
      },
    };
  }, []);

  const setTyping = useCallback((isTyping) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { username: usernameRef.current, typing: isTyping },
    });
  }, []);

  const leaveRoom = useCallback(async () => {
    await leaveChannel();
    clearSession();
    dispatch({ type: "LEFT" });
  }, [leaveChannel]);

  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []);

  const value = useMemo(
    () => ({ ...state, createRoom, joinRoom, listRooms, sendMessage, uploadAttachment, setTyping, leaveRoom, clearError }),
    [state, createRoom, joinRoom, listRooms, sendMessage, uploadAttachment, setTyping, leaveRoom, clearError]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
