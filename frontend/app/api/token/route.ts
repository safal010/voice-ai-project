import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json(
      { error: "Missing LiveKit environment variables" },
      { status: 500 }
    );
  }

  // The browser's anonymous ID. Only accept a safe, simple format.
  const body = await request.json().catch(() => null);
  const ownerId =
    typeof body?.ownerId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.ownerId)
      ? body.ownerId
      : "anonymous";

  const roomName = `voice-room-${Math.random().toString(36).slice(2, 8)}`;
  const identity = `user-${Math.random().toString(36).slice(2, 8)}`;

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    metadata: JSON.stringify({ ownerId }),
  });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, url, roomName });
}