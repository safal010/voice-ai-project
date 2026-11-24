import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  const ownerId = request.headers.get("x-owner-id");
  if (!ownerId) {
    return NextResponse.json({ error: "Missing x-owner-id header" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.language, c.created_at,
            COUNT(m.id)::int AS message_count
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id
     WHERE c.owner_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC
     LIMIT 50`,
    [ownerId]
  );

  return NextResponse.json(rows);
}