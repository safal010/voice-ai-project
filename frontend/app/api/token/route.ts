import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json(
      { error: "Missing LiveKit environment variables" },
      { status: 500 }
    );
  }

  const roomName = `voice-room-${Math.random().toString(36).slice(2, 8)}`;
  const identity = `user-${Math.random().toString(36).slice(2, 8)}`;

  const at = new AccessToken(apiKey, apiSecret, { identity });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, url, roomName });
}