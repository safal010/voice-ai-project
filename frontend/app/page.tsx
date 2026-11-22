"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarVisualizer,
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import "@livekit/components-styles";

type Connection = { token: string; url: string };
type IconName =
  | "arrow"
  | "close"
  | "history"
  | "menu"
  | "mic"
  | "micOff"
  | "phone"
  | "plus"
  | "settings"
  | "spark";

const STATUS_LABELS: Record<string, string> = {
  connecting: "Connecting",
  initializing: "Asha is joining",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

function Icon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "arrow":
      return (
        <svg {...shared}>
          <path d="M7 17 17 7M7 7h10v10" />
        </svg>
      );
    case "close":
      return (
        <svg {...shared}>
          <path d="m18 6-12 12M6 6l12 12" />
        </svg>
      );
    case "history":
      return (
        <svg {...shared}>
          <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
          <path d="M3 3v5h5m4-1v5l3 2" />
        </svg>
      );
    case "menu":
      return (
        <svg {...shared}>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M9 4v16" />
        </svg>
      );
    case "mic":
      return (
        <svg {...shared}>
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0m-7 7v3m-4 0h8" />
        </svg>
      );
    case "micOff":
      return (
        <svg {...shared}>
          <path d="m3 3 18 18M9 9v3a3 3 0 0 0 5.12 2.12M15 9V6a3 3 0 0 0-5.8-1" />
          <path d="M5 11a7 7 0 0 0 12 4.9M19 11a7 7 0 0 1-.2 1.6M12 18v3m-4 0h8" />
        </svg>
      );
    case "phone":
      return (
        <svg {...shared}>
          <path d="M7.4 3.8 10 7.4 8.3 9.1a14 14 0 0 0 6.6 6.6l1.7-1.7 3.6 2.6-.6 3a1.8 1.8 0 0 1-2 1.4A18.7 18.7 0 0 1 3 6.4a1.8 1.8 0 0 1 1.4-2l3-.6Z" />
        </svg>
      );
    case "plus":
      return (
        <svg {...shared}>
          <path d="M12 5v14m-7-7h14" />
        </svg>
      );
    case "settings":
      return (
        <svg {...shared}>
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
          <path d="m19.4 15 .1.1 1.2.9-1.2 2.1-1.5-.5a8 8 0 0 1-1.6.9l-.3 1.6h-2.4l-.3-1.6a8 8 0 0 1-1.7-.9l-1.5.5L9 16l1.2-.9a8 8 0 0 1 0-1.9L9 12.3l1.2-2.1 1.5.5a8 8 0 0 1 1.7-.9l.3-1.6h2.4l.3 1.6a8 8 0 0 1 1.6.9l1.5-.5 1.2 2.1-1.2.9a8 8 0 0 1-.1 1.8Z" />
        </svg>
      );
    case "spark":
      return (
        <svg {...shared}>
          <path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z" />
          <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
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
    <div className="transcript" ref={boxRef} role="log" aria-live="polite">
      {transcriptions.length === 0 ? (
        <div className="transcript-empty">
          <span className="transcript-empty-icon">
            <Icon name="spark" size={18} />
          </span>
          <p>Your conversation will appear here</p>
          <span>Start speaking whenever you&apos;re ready.</span>
        </div>
      ) : (
        transcriptions.map((transcription) => {
          const isUser =
            transcription.participantInfo.identity === localParticipant.identity;

          return (
            <article
              key={transcription.streamInfo.id}
              className={`transcript-message ${isUser ? "user" : "assistant"}`}
            >
              <span className="message-author">
                {isUser ? "You" : "Asha"}
              </span>
              <p>{transcription.text}</p>
            </article>
          );
        })
      )}
    </div>
  );
}

function SettingsDialog({
  open,
  onClose,
  connected,
  microphoneEnabled,
  onToggleMicrophone,
}: {
  open: boolean;
  onClose: () => void;
  connected: boolean;
  microphoneEnabled?: boolean;
  onToggleMicrophone?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">PREFERENCES</span>
            <h2 id="settings-title">Voice settings</h2>
          </div>
          <button
            className="icon-button dialog-close"
            type="button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {connected && onToggleMicrophone ? (
          <div className="setting-row">
            <span className="setting-icon">
              <Icon name={microphoneEnabled ? "mic" : "micOff"} />
            </span>
            <div className="setting-copy">
              <strong>Microphone</strong>
              <span>
                {microphoneEnabled ? "Your mic is on" : "Your mic is muted"}
              </span>
            </div>
            <button
              className={`switch ${microphoneEnabled ? "is-on" : ""}`}
              type="button"
              role="switch"
              aria-checked={microphoneEnabled}
              aria-label="Toggle microphone"
              onClick={onToggleMicrophone}
            >
              <span />
            </button>
          </div>
        ) : (
          <div className="settings-note">
            <span className="setting-icon">
              <Icon name="mic" />
            </span>
            <div className="setting-copy">
              <strong>Microphone controls</strong>
              <span>Start a conversation to manage your microphone.</span>
            </div>
          </div>
        )}
        <p className="settings-footnote">
          Your browser may ask for microphone permission when you start a call.
        </p>
      </section>
    </div>
  );
}

function VoiceUI({
  settingsOpen,
  onCloseSettings,
  onDisconnect,
}: {
  settingsOpen: boolean;
  onCloseSettings: () => void;
  onDisconnect: () => void;
}) {
  const { state, audioTrack } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const status = STATUS_LABELS[state] ?? "Connecting to Asha";

  function toggleMicrophone() {
    void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }

  return (
    <>
      <div className="session-heading">
        <div>
          <span className="eyebrow">VOICE SESSION</span>
          <h1>You&apos;re talking with Asha</h1>
          <p>A warm space to practice, ask questions, and explore ideas.</p>
        </div>
        <span className="session-live">
          <span className="live-dot" />
          In session
        </span>
      </div>

      <div className="conversation-layout">
        <section className="assistant-panel" aria-label="Voice controls">
          <div
            className="assistant-status"
            data-state={state}
            aria-live="polite"
          >
            <span className="status-dot" />
            {status}
          </div>
          <div className={`voice-orb state-${state}`}>
            <div className="orb-ring orb-ring-outer" />
            <div className="orb-ring orb-ring-inner" />
            <div className="orb-core">
              <span className="orb-glow" />
              <div className="orb-visualizer" aria-hidden="true">
                <BarVisualizer
                  state={state}
                  barCount={7}
                  trackRef={audioTrack}
                />
              </div>
            </div>
          </div>
          <div className="voice-caption">
            <h2>
              {state === "speaking"
                ? "Asha is speaking"
                : state === "thinking"
                  ? "Asha is thinking"
                  : state === "listening"
                    ? "I'm listening"
                    : "Getting things ready"}
            </h2>
            <p>
              {isMicrophoneEnabled
                ? "Speak naturally. Asha is here with you."
                : "Your microphone is muted. Unmute when you’re ready."}
            </p>
          </div>
          <div className="call-controls">
            <button
              className={`control-button microphone-control ${isMicrophoneEnabled ? "" : "is-muted"}`}
              type="button"
              aria-label={
                isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"
              }
              aria-pressed={isMicrophoneEnabled}
              onClick={toggleMicrophone}
            >
              <Icon name={isMicrophoneEnabled ? "mic" : "micOff"} size={21} />
              <span>{isMicrophoneEnabled ? "Mute" : "Unmute"}</span>
            </button>
            <button
              className="control-button end-call-control"
              type="button"
              onClick={onDisconnect}
            >
              <Icon name="phone" size={21} />
              <span>End conversation</span>
            </button>
          </div>
        </section>

        <section className="transcript-panel" aria-label="Live transcript">
          <div className="transcript-heading">
            <div>
              <h2>Conversation</h2>
              <p>Your words, as they happen</p>
            </div>
            <span className="transcript-live">
              <span className="live-dot" />
              LIVE
            </span>
          </div>
          <Transcript />
          <div className="transcript-footer">
            <Icon name="mic" size={15} />
            <span>
              {isMicrophoneEnabled
                ? "Listening for your voice"
                : "Microphone muted"}
            </span>
          </div>
        </section>
      </div>

      {settingsOpen && (
        <SettingsDialog
          open={settingsOpen}
          onClose={onCloseSettings}
          connected
          microphoneEnabled={isMicrophoneEnabled}
          onToggleMicrophone={toggleMicrophone}
        />
      )}
    </>
  );
}

export default function Page() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function connect() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/token", { method: "POST" });
      if (!response.ok) throw new Error("Could not get a token");
      const data = await response.json();
      setConnection({ token: data.token, url: data.url });
    } catch {
      setError("Connection failed. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  function startNewConversation() {
    setMobileSidebarOpen(false);
    setSettingsOpen(false);
    setError("");
    if (connection) {
      setConnection(null);
      return;
    }
    void connect();
  }

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 780px)").matches) {
      setMobileSidebarOpen((open) => !open);
      return;
    }
    setSidebarCollapsed((collapsed) => !collapsed);
  }

  return (
    <main className="app-shell">
      {mobileSidebarOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <aside
        id="app-sidebar"
        className={`sidebar ${sidebarCollapsed ? "is-collapsed" : ""} ${mobileSidebarOpen ? "is-mobile-open" : ""}`}
      >
        <div className="brand">
          <span className="brand-mark">
            <Icon name="spark" size={21} />
          </span>
          <span className="brand-name">asha<span>.</span></span>
          <button
            className="icon-button sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        <button
          className="new-conversation"
          type="button"
          onClick={startNewConversation}
          disabled={loading}
        >
          <Icon name="plus" size={19} />
          <span>{connection ? "New conversation" : "Start a conversation"}</span>
        </button>

        <div className="sidebar-section">
          <span className="sidebar-label">YOUR SPACE</span>
          <div className="history-heading">
            <span>Recent conversations</span>
          </div>
          {connection ? (
            <div className="history-item is-active">
              <span className="history-icon">
                <Icon name="history" size={17} />
              </span>
              <span className="history-title">Current session</span>
              <span className="history-indicator" />
            </div>
          ) : (
            <div className="history-empty">
              <span>No saved conversations yet</span>
              <span>Sessions aren&apos;t stored between visits.</span>
            </div>
          )}
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-bottom">
          <button
            className="sidebar-link"
            type="button"
            onClick={() => {
              setSettingsOpen(true);
              setMobileSidebarOpen(false);
            }}
          >
            <Icon name="settings" size={18} />
            <span>Voice settings</span>
          </button>
          <div className="profile-card">
            <span className="profile-avatar">A</span>
            <span className="profile-copy">
              <strong>Asha</strong>
              <span>Your voice companion</span>
            </span>
            <span className="profile-indicator" />
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button navigation-toggle"
            type="button"
            aria-label="Toggle navigation menu"
            aria-controls="app-sidebar"
            onClick={toggleSidebar}
          >
            <Icon name="menu" />
          </button>
          <div className="topbar-context">
            <span>Voice studio</span>
            <span className="topbar-divider">/</span>
            <span>{connection ? "Live conversation" : "Home"}</span>
          </div>
          <div className="topbar-assistant">
            <span className="assistant-avatar">
              <Icon name="spark" size={15} />
            </span>
            <span>Asha</span>
            <span className="assistant-availability" />
          </div>
        </header>

        {connection ? (
          <LiveKitRoom
            serverUrl={connection.url}
            token={connection.token}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={() => setConnection(null)}
          >
            <div className="session-page">
              <VoiceUI
                settingsOpen={settingsOpen}
                onCloseSettings={() => setSettingsOpen(false)}
                onDisconnect={() => setConnection(null)}
              />
            </div>
            <RoomAudioRenderer />
          </LiveKitRoom>
        ) : (
          <section className="welcome-page">
            <div className="welcome-copy">
              <span className="welcome-kicker">
                <span className="live-dot" />
                YOUR PERSONAL VOICE SPACE
              </span>
              <h1>
                A better way
                <br />
                to <span>think out loud.</span>
              </h1>
              <p>
                Talk naturally with Asha. Practice English, explore a question,
                or just follow your curiosity.
              </p>
              <button
                className="start-button"
                type="button"
                onClick={() => void connect()}
                disabled={loading}
              >
                <span className="start-button-icon">
                  <Icon name="mic" size={19} />
                </span>
                <span>{loading ? "Connecting..." : "Start a conversation"}</span>
                {!loading && <Icon name="arrow" size={17} />}
              </button>
              {error && (
                <p className="connection-error" role="alert">
                  {error}
                </p>
              )}
              <div className="welcome-prompts" aria-label="Things to try">
                <span>Try a conversation about</span>
                <div>
                  <span>English practice</span>
                  <span>Today&apos;s news</span>
                  <span>Something curious</span>
                </div>
              </div>
            </div>
            <div className="welcome-art" aria-hidden="true">
              <div className="welcome-orbit orbit-one" />
              <div className="welcome-orbit orbit-two" />
              <div className="welcome-orb">
                <span className="welcome-orb-highlight" />
                <Icon name="spark" size={31} />
              </div>
              <span className="art-caption">A little more human.</span>
            </div>
            <div className="welcome-footer">
              <span>
                <span className="footer-dot" />
                Real-time voice conversation
              </span>
              <span className="footer-separator" />
              <span>Your microphone is only active during a session</span>
            </div>
          </section>
        )}
      </div>

      {!connection && (
        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          connected={false}
        />
      )}
    </main>
  );
}
