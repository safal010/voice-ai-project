"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
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
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "AI is speaking...",
  idle: "Online",
  disconnected: "Tap to speak",
};

function getOwnerId(): string {
  try {
    let id = localStorage.getItem("asha_owner_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("asha_owner_id", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

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

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Icon({
  name,
  size = 18,
}: {
  name: "spark" | "history" | "arrow" | "mic" | "phone" | "lock" | "clock" | "edit" | "trash" | "close" | "settings" | "plus";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "spark":
      return (
        <svg {...common}>
          <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
          <path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <path d="M5.2 4.5a2 2 0 0 1 2.1-.5l2.2.9a2 2 0 0 1 1.2 2.3l-.5 2a2 2 0 0 0 .5 1.9l2.2 2.2a2 2 0 0 0 1.9.5l2-.5a2 2 0 0 1 2.3 1.2l.9 2.2a2 2 0 0 1-.5 2.1l-1 1a3 3 0 0 1-3 .7A19 19 0 0 1 3.5 8.5a3 3 0 0 1 .7-3l1-1Z" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
          <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
  }
}

function Transcript() {
  const transcriptions = useTranscriptions();
  const { localParticipant } = useLocalParticipant();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [transcriptions]);

  return (
    <div
      className="transcript"
      ref={boxRef}
      role="log"
      aria-label="Live conversation transcript"
      aria-live="polite"
    >
      {transcriptions.length === 0 && (
        <div className="transcript-empty">
          <span className="empty-wave" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <p>Your conversation will appear here</p>
          <span>Say hello to Asha to get started.</span>
        </div>
      )}
      {transcriptions.map((transcription) => {
        const isUser =
          transcription.participantInfo.identity === localParticipant.identity;
        const time = new Date(transcription.streamInfo.timestamp);
        return (
          <article
            key={transcription.streamInfo.id}
            className={`transcript-message ${isUser ? "user" : "assistant"}`}
          >
            <div className="message-meta">
              <span>{isUser ? "You" : "Asha"}</span>
              <time dateTime={time.toISOString()}>{formatTime(time)}</time>
            </div>
            <p>{transcription.text}</p>
          </article>
        );
      })}
    </div>
  );
}

function VoiceUI({
  onDisconnect,
  onStatusChange,
  onMicrophoneChange,
  onRegisterMicrophoneToggle,
}: {
  onDisconnect: () => void;
  onStatusChange: (status: string) => void;
  onMicrophoneChange: (enabled: boolean) => void;
  onRegisterMicrophoneToggle: (toggle: (() => void) | null) => void;
}) {
  const { state, audioTrack } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [microphoneError, setMicrophoneError] = useState("");

  const toggleMicrophone = useCallback(() => {
    setMicrophoneError("");
    void localParticipant
      .setMicrophoneEnabled(!isMicrophoneEnabled)
      .catch(() => setMicrophoneError("Microphone access failed. Check your browser permissions and try again."));
  }, [isMicrophoneEnabled, localParticipant]);

  useEffect(() => {
    onStatusChange(state);
  }, [onStatusChange, state]);

  useEffect(() => {
    onMicrophoneChange(isMicrophoneEnabled);
  }, [isMicrophoneEnabled, onMicrophoneChange]);

  useEffect(() => {
    onRegisterMicrophoneToggle(toggleMicrophone);
    return () => onRegisterMicrophoneToggle(null);
  }, [onRegisterMicrophoneToggle, toggleMicrophone]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const minutes = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");

  return (
    <section className="call-view" aria-label="Live call with Asha">
      <div className="call-heading">
        <div>
          <span className="eyebrow">VOICE SESSION</span>
          <h1>Here with you.</h1>
        </div>
        <div className="call-clock" aria-label={`Call duration ${minutes}:${seconds}`}>
          <Icon name="clock" size={15} />
          <span>{minutes}:{seconds}</span>
        </div>
      </div>

      <div className="conversation-layout">
        <section className="assistant-panel" aria-label="Asha voice assistant">
          <div className="assistant-status" data-state={state} aria-live="polite">
            <span className="status-dot" />
            {STATUS_LABELS[state] ?? "Tap to speak"}
          </div>
          <div className={`voice-orb state-${state}`} aria-hidden="true">
            <span className="orb-ring orb-ring-outer" />
            <span className="orb-ring orb-ring-inner" />
            <div className="orb-core">
              <span className="orb-glow" />
              <div className="orb-visualizer" data-lk-theme="default">
                <BarVisualizer state={state} barCount={9} trackRef={audioTrack} />
              </div>
            </div>
          </div>
          <div className="voice-caption">
            <h2>Asha</h2>
            <p>Your voice companion</p>
          </div>
        </section>

        <section className="transcript-panel" aria-label="Conversation transcript">
          <div className="transcript-heading">
            <div>
              <span className="eyebrow">IN THIS CONVERSATION</span>
              <h2>Live transcript</h2>
            </div>
            <span className="transcript-live">
              <span className="live-dot" />
              LIVE
            </span>
          </div>
          <Transcript />
          <div className="transcript-footer">
            <Icon name="lock" size={14} />
            <span>Your conversation is saved privately in this browser.</span>
          </div>
        </section>
      </div>
      <div className="voice-control-panel">
        <p className="control-status" data-state={state} aria-live="polite">
          <span className="status-dot" />
          {STATUS_LABELS[state] ?? "Tap to speak"}
        </p>
        <div className="voice-control-actions">
          <div className="control-spacer" aria-hidden="true" />
          <button
            className={`microphone-control state-${state} ${isMicrophoneEnabled ? "" : "is-muted"}`}
            onClick={toggleMicrophone}
            aria-label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
            aria-pressed={isMicrophoneEnabled}
            title={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            <Icon name="mic" size={25} />
          </button>
          <button
            className="end-call-control"
            onClick={onDisconnect}
            aria-label="End conversation"
            title="End conversation"
          >
            <Icon name="phone" size={17} />
            <span>End</span>
          </button>
        </div>
        <p className={`microphone-hint ${microphoneError ? "has-error" : ""}`} role={microphoneError ? "alert" : undefined}>
          {microphoneError || (isMicrophoneEnabled ? "Microphone on · tap to mute" : "Microphone muted · tap to unmute")}
        </p>
      </div>
    </section>
  );
}

function History({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [open, setOpen] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api("/api/conversations"));
      setError("");
    } catch {
      setError("Could not load your conversations.");
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function openConversation(id: number) {
    try {
      setOpen(await api(`/api/conversations/${id}`));
      setError("");
    } catch {
      setError("Could not open that conversation.");
    }
  }

  function beginRename(conversation: ConversationSummary | ConversationDetail) {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
    setError("");
  }

  async function rename(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    const title = editTitle.trim();
    if (!title) return;
    setSavingId(id);
    try {
      await api(`/api/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      if (open && open.id === id) setOpen({ ...open, title });
      setEditingId(null);
      await load();
    } catch {
      setError("Could not rename it.");
    } finally {
      setSavingId(null);
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

  function renderRenameForm(id: number) {
    return (
      <form className="rename-form" onSubmit={(event) => void rename(event, id)}>
        <label className="sr-only" htmlFor={`conversation-title-${id}`}>
          Conversation title
        </label>
        <input
          id={`conversation-title-${id}`}
          autoFocus
          value={editTitle}
          maxLength={120}
          onChange={(event) => setEditTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditingId(null);
          }}
        />
        <button className="text-button save-button" type="submit" disabled={!editTitle.trim() || savingId === id}>
          {savingId === id ? "Saving..." : "Save"}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => setEditingId(null)}
          aria-label="Cancel renaming"
        >
          Cancel
        </button>
      </form>
    );
  }

  if (open) {
    return (
      <section className="history-view">
        <div className="history-topline">
          <button className="back-button" onClick={() => setOpen(null)}>
            <span aria-hidden="true">←</span> All conversations
          </button>
          <span className="history-count">{open.message_count} messages</span>
        </div>
        <div className="history-detail-heading">
          <div>
            <span className="eyebrow">SAVED CONVERSATION</span>
            {editingId === open.id ? (
              renderRenameForm(open.id)
            ) : (
              <h1>{open.title}</h1>
            )}
            <p>{formatDate(open.created_at)}</p>
          </div>
          <div className="history-actions">
            {editingId !== open.id && (
              <button
                className="quiet-button"
                onClick={() => beginRename(open)}
                aria-label="Rename conversation"
              >
                <Icon name="edit" size={15} /> Rename
              </button>
            )}
            <button className="quiet-button delete-button" onClick={() => void remove(open.id)}>
              <Icon name="trash" size={15} /> Delete
            </button>
          </div>
        </div>
        <div className="saved-transcript">
          {open.messages.length === 0 && (
            <div className="empty-state compact-empty">
              <span className="empty-icon"><Icon name="history" size={22} /></span>
              <h2>No messages saved</h2>
              <p>This conversation does not contain any messages yet.</p>
            </div>
          )}
          {open.messages.map((message) => (
            <article
              key={message.id}
              className={`transcript-message ${message.role === "user" ? "user" : "assistant"}`}
            >
              <div className="message-meta">
                <span>{message.role === "user" ? "You" : "Asha"}</span>
                <time dateTime={message.created_at}>{formatDate(message.created_at)}</time>
              </div>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section className="history-view">
      <div className="history-topline">
        <button className="back-button" onClick={onBack}>
          <span aria-hidden="true">←</span> Back to Asha
        </button>
        <span className="history-count">
          {items ? `${items.length} saved ${items.length === 1 ? "conversation" : "conversations"}` : "Your private library"}
        </span>
      </div>
      <div className="history-page-heading">
        <div>
          <span className="eyebrow">YOUR PRIVATE LIBRARY</span>
          <h1>Conversation history</h1>
          <p>Pick up where you left off, or revisit something you learned.</p>
        </div>
        <div className="history-mark"><Icon name="history" size={22} /></div>
      </div>

      {items === null && !error && (
        <div className="history-list" aria-label="Loading conversations" aria-busy="true">
          {[0, 1, 2].map((item) => (
            <div className="history-skeleton" key={item}>
              <span className="skeleton-line skeleton-title" />
              <span className="skeleton-line skeleton-meta" />
              <span className="skeleton-badge" />
            </div>
          ))}
        </div>
      )}

      {items !== null && items.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon"><Icon name="history" size={22} /></span>
          <h2>Your story starts here</h2>
          <p>Conversations with Asha will appear here so you can revisit them anytime.</p>
          <button className="text-button start-link" onClick={onBack}>
            Start a conversation <Icon name="arrow" size={15} />
          </button>
        </div>
      )}

      {items !== null && items.length > 0 && (
        <ul className="history-list">
          {items.map((conversation) => (
            <li key={conversation.id} className="history-card">
              <div className="history-card-icon"><Icon name="spark" size={17} /></div>
              <div className="history-card-content">
                {editingId === conversation.id ? (
                  renderRenameForm(conversation.id)
                ) : (
                  <button
                    className="history-open"
                    onClick={() => void openConversation(conversation.id)}
                  >
                    <span className="history-name">{conversation.title}</span>
                    <span className="history-meta">
                      <span><Icon name="clock" size={13} /> {formatDate(conversation.created_at)}</span>
                      <span className="meta-divider" />
                      <span>{conversation.message_count} messages</span>
                    </span>
                  </button>
                )}
              </div>
              <span className="language-badge">{conversation.language || "English"}</span>
              <div className="history-actions">
                <button
                  className="action-icon"
                  onClick={() => beginRename(conversation)}
                  aria-label={`Rename ${conversation.title}`}
                  title="Rename"
                >
                  <Icon name="edit" size={16} />
                </button>
                <button
                  className="action-icon delete-button"
                  onClick={() => void remove(conversation.id)}
                  aria-label={`Delete ${conversation.title}`}
                  title="Delete"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div className="error-message history-error" role="alert">
          <span>{error}</span>
          {items === null && (
            <button className="text-button" onClick={() => void load()}>Try again</button>
          )}
        </div>
      )}
      <p className="history-privacy"><Icon name="lock" size={13} /> Your saved conversations are private to this browser.</p>
    </section>
  );
}

export default function Page() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assistantStatus, setAssistantStatus] = useState("idle");
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const microphoneToggleRef = useRef<(() => void) | null>(null);
  const activeTokenRef = useRef<string | null>(null);

  const registerMicrophoneToggle = useCallback((toggle: (() => void) | null) => {
    microphoneToggleRef.current = toggle;
  }, []);

  async function connect() {
    setLoading(true);
    setError("");
    setAssistantStatus("connecting");
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: getOwnerId() }),
      });
      if (!res.ok) throw new Error("Could not get a token");
      const data = await res.json();
      activeTokenRef.current = data.token;
      setConnection({ token: data.token, url: data.url });
    } catch {
      setError("Connection failed. Is the server running?");
      setAssistantStatus("idle");
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    activeTokenRef.current = null;
    setConnection(null);
    setAssistantStatus("idle");
    setMicrophoneEnabled(true);
  }

  async function startNewConversation() {
    setShowHistory(false);
    setSettingsOpen(false);
    if (connection) disconnect();
    await connect();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Voice AI">
          <span className="brand-mark"><Icon name="spark" size={19} /></span>
          <span className="brand-name">Voice AI</span>
        </div>
        <div className="topbar-right">
          <span className={`availability ${connection ? "is-active" : ""}`}>
            <i />
            <span>{connection ? STATUS_LABELS[assistantStatus] ?? "Connecting..." : "Online"}</span>
          </span>
          <button className="new-conversation-button" onClick={() => void startNewConversation()} disabled={loading}>
            <Icon name="plus" size={16} />
            <span>New conversation</span>
          </button>
          <button
            className={`icon-button ${settingsOpen ? "is-active" : ""}`}
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label="Voice settings"
            aria-expanded={settingsOpen}
            title="Voice settings"
          >
            <Icon name="settings" size={17} />
          </button>
          {!connection && !showHistory && (
            <button
              className="icon-button history-nav"
              onClick={() => setShowHistory(true)}
              aria-label="Conversation history"
              title="Conversation history"
            >
              <Icon name="history" size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="app-content">
        {settingsOpen && (
          <div className="settings-backdrop" onClick={() => setSettingsOpen(false)}>
            <section
              className="settings-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="settings-heading">
                <div>
                  <span className="eyebrow">PREFERENCES</span>
                  <h2 id="settings-title">Voice settings</h2>
                </div>
                <button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                  <Icon name="close" size={17} />
                </button>
              </div>
              <div className="settings-option">
                <div>
                  <strong>Microphone</strong>
                  <p>{connection ? (microphoneEnabled ? "On and ready to listen" : "Muted for this conversation") : "Browser audio is ready when you start a conversation"}</p>
                </div>
                {connection && (
                  <button
                    className={`settings-toggle ${microphoneEnabled ? "is-on" : ""}`}
                    onClick={() => microphoneToggleRef.current?.()}
                    aria-label={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}
                    aria-pressed={microphoneEnabled}
                  >
                    <span />
                  </button>
                )}
              </div>
              <p className="settings-footnote">Your conversation stays private to this browser.</p>
            </section>
          </div>
        )}
        {showHistory ? (
          <History onBack={() => setShowHistory(false)} />
        ) : connection ? (
          <LiveKitRoom
            key={connection.token}
            serverUrl={connection.url}
            token={connection.token}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={() => {
              if (activeTokenRef.current === connection.token) disconnect();
            }}
          >
            <VoiceUI
              onDisconnect={disconnect}
              onStatusChange={setAssistantStatus}
              onMicrophoneChange={setMicrophoneEnabled}
              onRegisterMicrophoneToggle={registerMicrophoneToggle}
            />
            <RoomAudioRenderer />
          </LiveKitRoom>
        ) : (
          <section className="welcome-page">
            <div className="welcome-copy">
              <span className="welcome-kicker"><i /> A MORE NATURAL WAY TO PRACTICE</span>
              <h1>Find your voice.<br /><span>Start speaking.</span></h1>
              <p>
                Meet Asha, your thoughtful English-practice partner. Have a real
                conversation, build confidence, and learn as you go.
              </p>
              <button className="start-button" onClick={() => void connect()} disabled={loading}>
                <span className="start-button-icon"><Icon name="spark" size={18} /></span>
                <span>{loading ? "Connecting to Asha..." : "Start conversation"}</span>
                {!loading && <Icon name="arrow" size={17} />}
              </button>
              {error && <p className="connection-error" role="alert">{error}</p>}
              <div className="feature-chips" aria-label="Features">
                <span><i className="feature-dot violet" /> Real-time voice</span>
                <span><i className="feature-dot cyan" /> Live transcript</span>
                <span><i className="feature-dot lilac" /> Saved history</span>
              </div>
              <p className="privacy-note"><Icon name="lock" size={13} /> Your conversations are saved privately in this browser.</p>
            </div>
            <div className="welcome-art" aria-label="Asha, your AI voice companion">
              <div className="art-glow" />
              <span className="welcome-orbit orbit-one" />
              <span className="welcome-orbit orbit-two" />
              <span className="welcome-orbit orbit-three" />
              <div className="welcome-orb">
                <span className="orb-highlight" />
                <div className="orb-symbol"><Icon name="spark" size={30} /></div>
              </div>
              <div className="art-caption"><span className="availability"><i /> READY WHEN YOU ARE</span></div>
              <div className="floating-note note-top"><span className="note-wave">〰</span> Asha is listening</div>
              <div className="floating-note note-bottom"><span>EN</span> Practice at your pace</div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
