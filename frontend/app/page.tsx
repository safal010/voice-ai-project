"use client";

import { useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  BarVisualizer,
  useVoiceAssistant,
  useLocalParticipant,
  useTranscriptions,
} from "@livekit/components-react";
import "@livekit/components-styles";

type Connection = { token: string; url: string };

type ConversationSummary = {
  id: number;
  title: string;
  language: string;
  created_at: string;
  message_count: number;
};

type SavedMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type ConversationDetail = ConversationSummary & { messages: SavedMessage[] };

const STATUS_LABELS: Record<string, string> = {
  connecting: "Connecting...",
  initializing: "Waking up the assistant (this can take a minute)...",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

// A random ID for this browser, created once and remembered.
function getOwnerId(): string {
  try {
    let id = localStorage.getItem("asha_owner_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("asha_owner_id", id);
    }
    return id;
  } catch {
    return crypto.randomUUID(); // storage blocked: a temporary ID
  }
}

// Calls our own API and always includes the owner ID.
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-owner-id", getOwnerId());
  if (init.body) headers.set("Content-Type", "application/json");

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Transcript() {
  const transcriptions = useTranscriptions();
  const { localParticipant } = useLocalParticipant();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [transcriptions]);

  return (
    <div className="transcript" ref={boxRef}>
      {transcriptions.length === 0 && (
        <p className="hint">Say hello to start the conversation</p>
      )}
      {transcriptions.map((t) => {
        const isUser = t.participantInfo.identity === localParticipant.identity;
        return (
          <div
            key={t.streamInfo.id}
            className={`bubble ${isUser ? "user" : "agent"}`}
          >
            {t.text}
          </div>
        );
      })}
    </div>
  );
}

function VoiceUI({ onDisconnect }: { onDisconnect: () => void }) {
  const { state, audioTrack } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  return (
    <>
      <div className="badge" data-state={state}>
        <span className="dot" />
        {STATUS_LABELS[state] ?? "Waiting for agent..."}
      </div>

      <div className="visualizer" data-lk-theme="default">
        <BarVisualizer state={state} barCount={7} trackRef={audioTrack} />
      </div>

      <Transcript />

      <div className="row">
        <button
          className={isMicrophoneEnabled ? "btn" : "btn muted"}
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          {isMicrophoneEnabled ? "Mute" : "Unmute"}
        </button>
        <button className="btn danger" onClick={onDisconnect}>
          End call
        </button>
      </div>
    </>
  );
}

function History({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [open, setOpen] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems(await api("/api/conversations"));
      setError("");
    } catch {
      setError("Could not load your conversations.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openConversation(id: number) {
    try {
      setOpen(await api(`/api/conversations/${id}`));
      setError("");
    } catch {
      setError("Could not open that conversation.");
    }
  }

  async function rename(id: number, current: string) {
    const title = window.prompt("New title", current)?.trim();
    if (!title) return;
    try {
      await api(`/api/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      if (open && open.id === id) setOpen({ ...open, title });
      await load();
    } catch {
      setError("Could not rename it.");
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    try {
      await api(`/api/conversations/${id}`, { method: "DELETE" });
      if (open && open.id === id) setOpen(null);
      await load();
    } catch {
      setError("Could not delete it.");
    }
  }

  if (open) {
    return (
      <>
        <div className="history-head">
          <button className="btn small" onClick={() => setOpen(null)}>
            Back
          </button>
          <strong className="history-title">{open.title}</strong>
        </div>
        <div className="transcript tall">
          {open.messages.length === 0 && <p className="hint">No messages saved.</p>}
          {open.messages.map((m) => (
            <div
              key={m.id}
              className={`bubble ${m.role === "user" ? "user" : "agent"}`}
            >
              {m.content}
            </div>
          ))}
        </div>
        <div className="row">
          <button className="btn small" onClick={() => rename(open.id, open.title)}>
            Rename
          </button>
          <button className="btn small danger" onClick={() => remove(open.id)}>
            Delete
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </>
    );
  }

  return (
    <>
      <div className="history-head">
        <button className="btn small" onClick={onBack}>
          Back
        </button>
        <strong className="history-title">Your conversations</strong>
      </div>

      {items === null && !error && <p className="hint">Loading...</p>}
      {items !== null && items.length === 0 && (
        <p className="hint">No saved conversations yet.</p>
      )}

      <ul className="history-list">
        {items?.map((c) => (
          <li key={c.id} className="history-item">
            <button className="history-open" onClick={() => openConversation(c.id)}>
              <span className="history-name">{c.title}</span>
              <span className="meta">
                {formatDate(c.created_at)} · {c.message_count} messages
              </span>
            </button>
            <div className="history-actions">
              <button className="btn small" onClick={() => rename(c.id, c.title)}>
                Rename
              </button>
              <button className="btn small danger" onClick={() => remove(c.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {error && <p className="error">{error}</p>}
    </>
  );
}

export default function Page() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  async function connect() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: getOwnerId() }),
      });
      if (!res.ok) throw new Error("Could not get a token");
      const data = await res.json();
      setConnection({ token: data.token, url: data.url });
    } catch {
      setError("Connection failed. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  let content;
  if (showHistory) {
    content = <History onBack={() => setShowHistory(false)} />;
  } else if (!connection) {
    content = (
      <>
        <button className="btn primary" onClick={connect} disabled={loading}>
          {loading ? "Connecting..." : "Start conversation"}
        </button>
        <div className="row-gap">
          <button className="btn small" onClick={() => setShowHistory(true)}>
            History
          </button>
        </div>
        <p className="notice">
          Your conversations are saved so you can read them later. Only this
          browser can see them.
        </p>
        {error && <p className="error">{error}</p>}
      </>
    );
  } else {
    content = (
      <LiveKitRoom
        serverUrl={connection.url}
        token={connection.token}
        connect={true}
        audio={true}
        video={false}
        onDisconnected={() => setConnection(null)}
      >
        <VoiceUI onDisconnect={() => setConnection(null)} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  return (
    <main className="card">
      <h1 className="title">AI Voice Chat</h1>
      <p className="subtitle">Talk to your assistant in real time</p>
      {content}
    </main>
  );
}