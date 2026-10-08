import React, { useEffect, useState } from "react";
import { useChat } from "../context/ChatContext.jsx";
import { gradientFor } from "../utils/avatar.js";

export default function EntryScreen({ displayName, setDisplayName }) {
  const { createRoom, joinRoom, listRooms, status, error, clearError } = useChat();
  const [step, setStep] = useState("cover"); // "cover" | "choose" | "form"
  const [mode, setMode] = useState(null); // "join" | "create"
  const [name, setName] = useState(displayName || "");
  const [room, setRoom] = useState("");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");
  const [maxUsers, setMaxUsers] = useState(20);
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    if (status !== "connected" || step !== "form" || mode !== "join") return;
    let cancelled = false;
    async function refresh() {
      const list = await listRooms();
      if (!cancelled) setRooms(list);
    }
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [status, listRooms, step, mode]);

  function chooseMode(next) {
    setMode(next);
    setStep("form");
    clearError();
  }

  function backToChoices() {
    setStep("choose");
    setMode(null);
    clearError();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!room.trim() || busy) return;
    setBusy(true);
    setDisplayName(name);
    if (mode === "create") {
      await createRoom(room, name, { description, password, maxUsers });
    } else {
      await joinRoom(room, name, password);
    }
    setBusy(false);
    // On success the room shows up in ChatContext state and App switches the
    // view automatically. On failure, `error` from context is already set
    // and rendered below.
  }

  // ---------- Step 1: cover ----------
  if (step === "cover") {
    return (
      <div className="ig-entry-screen">
        <div className="ig-cover-page">
          <div className="ig-cover-title">Bridge</div>
          <div className="ig-cover-slogan">Connects the Unconnected</div>
          <button className="ig-primary-btn ig-cover-cta" onClick={() => setStep("choose")}>
            Get started
          </button>
        </div>
      </div>
    );
  }

  // ---------- Step 2: choose Join or Create ----------
  if (step === "choose") {
    return (
      <div className="ig-entry-screen">
        <div className="ig-entry-card">
          <div className="ig-cover ig-cover-compact">
            <div className="ig-cover-title ig-cover-title-sm">Bridge</div>
          </div>

          <button className="ig-choice-card" onClick={() => chooseMode("join")}>
            <span className="ig-choice-icon">🔑</span>
            <span className="ig-choice-text">
              <span className="ig-choice-title">Join room</span>
              <span className="ig-choice-sub">Enter an existing room by name</span>
            </span>
            <span className="ig-choice-arrow">›</span>
          </button>

          <button className="ig-choice-card" onClick={() => chooseMode("create")}>
            <span className="ig-choice-icon">✨</span>
            <span className="ig-choice-text">
              <span className="ig-choice-title">Create room</span>
              <span className="ig-choice-sub">Start a brand new room</span>
            </span>
            <span className="ig-choice-arrow">›</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------- Step 3: the actual form ----------
  return (
    <div className="ig-entry-screen">
      <div className="ig-entry-card">
        <button type="button" className="ig-entry-back" onClick={backToChoices}>
          ‹ Back
        </button>

        <div className="ig-cover ig-cover-compact">
          <div className="ig-cover-title ig-cover-title-sm">Bridge</div>
        </div>

        <h1 className="ig-entry-title">{mode === "create" ? "Start a new room" : "Join a room"}</h1>
        <p className="ig-entry-sub">
          {mode === "create"
            ? "Name it, lock it with a password if you want, and jump straight in."
            : "Pick an open room below, or type a room name to join."}
        </p>

        <form onSubmit={handleSubmit}>
          <label className="ig-field">
            <span>Your name</span>
            <input
              autoFocus
              placeholder="e.g. Priya"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="ig-field">
            <span>Room name</span>
            <input
              placeholder={mode === "create" ? "e.g. weekend-plans" : "e.g. team-standup"}
              value={room}
              maxLength={40}
              onChange={(e) => setRoom(e.target.value)}
            />
          </label>

          {mode === "create" && (
            <>
              <label className="ig-field">
                <span>Topic (optional)</span>
                <input
                  placeholder="What's this room about?"
                  value={description}
                  maxLength={140}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div className="ig-field-row">
                <label className="ig-field">
                  <span>Password (optional)</span>
                  <input
                    type="password"
                    placeholder="Leave blank for public"
                    value={password}
                    maxLength={64}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label className="ig-field ig-field-narrow">
                  <span>Max people</span>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(e.target.value)}
                  />
                </label>
              </div>
            </>
          )}

          {mode === "join" && (
            <label className="ig-field">
              <span>Password (only if the room is private)</span>
              <input
                type="password"
                placeholder="Leave blank for public rooms"
                value={password}
                maxLength={64}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}

          {error && <div className="ig-error">{error}</div>}

          <button
            type="submit"
            className="ig-primary-btn"
            disabled={status !== "connected" || !room.trim() || busy}
          >
            {status !== "connected" ? "Connecting…" : busy ? "Working…" : mode === "create" ? "Create room" : "Join room"}
          </button>
        </form>

        {mode === "join" && (
          <div className="ig-entry-rooms">
            <div className="ig-entry-rooms-heading">Open rooms</div>
            {rooms.length === 0 && <div className="ig-entry-rooms-empty">No public rooms yet — create one.</div>}
            <ul>
              {rooms.map((r) => (
                <li key={r.room} onClick={() => setRoom(r.room)}>
                  <span className="ig-avatar ig-avatar-sm" style={{ background: gradientFor(r.room) }}>
                    {r.room.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="ig-entry-room-text">
                    <span className="ig-entry-room-name">{r.room}</span>
                    <span className="ig-entry-room-desc">{r.description || `Up to ${r.maxUsers} people`}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
