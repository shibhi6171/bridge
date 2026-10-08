import React from "react";
import { useChat } from "../context/ChatContext.jsx";
import MessageList from "./MessageList.jsx";
import MessageInput from "./MessageInput.jsx";
import { gradientFor } from "../utils/avatar.js";

export default function ChatRoom() {
  const { room, roomMeta, users, typingUsers, leaveRoom } = useChat();

  const typingText =
    typingUsers.length === 0
      ? null
      : typingUsers.length === 1
      ? `${typingUsers[0]} is typing…`
      : `${typingUsers.length} people typing…`;

  return (
    <main className="ig-chat ig-chat-fullscreen">
      <header className="ig-chat-header">
        <button className="ig-back-btn" onClick={leaveRoom} aria-label="Leave room">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className="ig-avatar" style={{ background: gradientFor(room) }}>
          {room.slice(0, 1).toUpperCase()}
        </span>
        <div className="ig-chat-header-text">
          <span className="ig-chat-header-name">{room}</span>
          <span className="ig-chat-header-sub">
            {typingText || `${users.length}${roomMeta?.maxUsers ? `/${roomMeta.maxUsers}` : ""} online${roomMeta?.isPrivate ? " · 🔒 private" : ""}`}
          </span>
        </div>
        <button className="ig-leave-btn" onClick={leaveRoom}>Leave</button>
      </header>

      <MessageList />
      <MessageInput />
    </main>
  );
}
