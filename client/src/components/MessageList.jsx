import React, { useEffect, useRef, useState } from "react";
import { useChat } from "../context/ChatContext.jsx";
import { gradientFor, colorFor } from "../utils/avatar.js";

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Attachment({ m, onOpenImage }) {
  if (!m.attachmentUrl) return null;
  if (m.attachmentType === "image") {
    return (
      <button className="ig-attachment-image-btn" onClick={() => onOpenImage(m.attachmentUrl)} aria-label="View photo">
        <img className="ig-attachment-image" src={m.attachmentUrl} alt={m.attachmentName || "attachment"} loading="lazy" />
      </button>
    );
  }
  return (
    <a className="ig-attachment-file" href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" download={m.attachmentName}>
      <span className="ig-attachment-file-icon"><FileIcon /></span>
      <span className="ig-attachment-file-text">
        <span className="ig-attachment-file-name">{m.attachmentName || "File"}</span>
        <span className="ig-attachment-file-size">{formatSize(m.attachmentSize)}</span>
      </span>
    </a>
  );
}

export default function MessageList() {
  const { messages, username } = useChat();
  const bottomRef = useRef(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="ig-messages">
      {messages.length === 0 && (
        <div className="ig-messages-empty">
          <div className="ig-messages-empty-icon">💬</div>
          <p>No messages yet. Say hi!</p>
        </div>
      )}
      {messages.map((m, i) => {
        if (m.system) {
          return (
            <div className="ig-system-msg" key={m.id}>
              {m.text}
            </div>
          );
        }
        const isSelf = m.username === username;
        const prev = messages[i - 1];
        const showAuthor = !isSelf && (!prev || prev.system || prev.username !== m.username);
        const isRunStart = !prev || prev.system || prev.username !== m.username;
        return (
          <div key={m.id} className={`ig-msg-row ${isSelf ? "is-self" : ""}`}>
            {showAuthor && <div className="ig-msg-author" style={{ color: colorFor(m.username) }}>{m.username}</div>}
            <div className="ig-bubble-wrap">
              {!isSelf && (
                <span
                  className={`ig-msg-avatar ${isRunStart ? "" : "ig-msg-avatar-spacer"}`}
                  style={isRunStart ? { background: gradientFor(m.username) } : undefined}
                >
                  {isRunStart ? m.username.slice(0, 1).toUpperCase() : ""}
                </span>
              )}
              <div className="ig-bubble-col">
                {m.attachmentUrl && (
                  <div className={`ig-attachment-wrap ${m.attachmentType === "image" ? "is-image" : ""}`}>
                    <Attachment m={m} onOpenImage={setLightboxUrl} />
                  </div>
                )}
                {m.text && (
                  <div
                    className={`ig-bubble ${isSelf ? "ig-bubble-self" : "ig-bubble-other"}`}
                    style={isSelf ? undefined : { background: colorFor(m.username) }}
                  >
                    {m.text}
                  </div>
                )}
                <span className="ig-msg-time">{formatTime(m.at)}</span>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />

      {lightboxUrl && (
        <div className="ig-lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="ig-lightbox-img" onClick={(e) => e.stopPropagation()} />
          <button className="ig-lightbox-close" onClick={() => setLightboxUrl(null)} aria-label="Close">✕</button>
        </div>
      )}
    </div>
  );
}
