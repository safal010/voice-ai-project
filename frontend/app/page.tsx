"use client";

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
import "@livekit/components-styles";

type Connection = { token: string; url: string };

const STATUS_LABELS: Record<string, string> = {
  connecting: "Connecting...",
  initializing: "Agent is joining...",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

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
            <div className="visualizer" data-lk-theme="default">
        <BarVisualizer state={state} barCount={7} trackRef={audioTrack} />
      </div>

      <Transcript />

      <div className="row"></div>
      <div className="badge" data-state={state}>
        <span className="dot" />
        {STATUS_LABELS[state] ?? "Waiting for agent..."}
      </div>

      <div className="visualizer" data-lk-theme="default">
        <BarVisualizer state={state} barCount={7} trackRef={audioTrack} />
      </div>

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

export default function Page() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function connect() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/token", { method: "POST" });
      if (!res.ok) throw new Error("Could not get a token");
      const data = await res.json();
      setConnection({ token: data.token, url: data.url });
    } catch (e) {
      setError("Connection failed. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="card">
      <h1 className="title">AI Voice Chat</h1>
      <p className="subtitle">Talk to your assistant in real time</p>

      {!connection ? (
        <>
          <button className="btn primary" onClick={connect} disabled={loading}>
            {loading ? "Connecting..." : "Start conversation"}
          </button>
          {error && <p className="error">{error}</p>}
        </>
      ) : (
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
      )}
    </main>
  );
}