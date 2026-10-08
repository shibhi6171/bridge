import React, { useRef, useState } from "react";
import { useChat } from "../context/ChatContext.jsx";

const TYPING_TIMEOUT_MS = 1500;

export default function MessageInput() {
  const { sendMessage, uploadAttachment, setTyping } = useChat();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const typingRef = useRef(false);
  const timeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  function handleChange(e) {
    setText(e.target.value);
    if (!typingRef.current) {
      typingRef.current = true;
      setTyping(true);
    }
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      typingRef.current = false;
      setTyping(false);
    }, TYPING_TIMEOUT_MS);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setText("");
    clearTimeout(timeoutRef.current);
    typingRef.current = false;
    setTyping(false);
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    const { attachment, error } = await uploadAttachment(file);
    setUploading(false);

    if (error) {
      setUploadError(error);
      return;
    }
    await sendMessage(text.trim(), attachment);
    setText("");
  }

  return (
    <div className="ig-composer-wrap">
      {uploadError && <div className="ig-error ig-upload-error">{uploadError}</div>}
      <form className="ig-composer" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          className="ig-file-input"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.txt,.zip,.csv,.xlsx"
        />
        <button
          type="button"
          className="ig-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Attach file"
          title="Attach a photo or file"
        >
          {uploading ? (
            <span className="ig-upload-spinner" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <input
          className="ig-composer-input"
          placeholder="Message..."
          value={text}
          onChange={handleChange}
          maxLength={2000}
        />
        <button type="submit" className="ig-send-btn" disabled={!text.trim()} aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </form>
    </div>
  );
}
