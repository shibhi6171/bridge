import React, { useState } from "react";
import { useChat } from "./context/ChatContext.jsx";
import EntryScreen from "./components/EntryScreen.jsx";
import ChatRoom from "./components/ChatRoom.jsx";

export default function App() {
  const { room, username } = useChat();
  const [displayName, setDisplayNameState] = useState(() => {
    try { return localStorage.getItem("wire:displayName") || ""; } catch { return ""; }
  });

  function setDisplayName(name) {
    setDisplayNameState(name);
    try { localStorage.setItem("wire:displayName", name); } catch {}
  }

  // If a room session was silently restored from a refresh, keep the local
  // name field in sync with whatever username was actually used to rejoin.
  React.useEffect(() => {
    if (username && username !== displayName) setDisplayName(username);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  if (!room) {
    return <EntryScreen displayName={displayName} setDisplayName={setDisplayName} />;
  }
  return <ChatRoom />;
}
