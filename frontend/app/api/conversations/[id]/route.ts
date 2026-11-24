import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// READ one conversation, with its messages
export async function GET(request: Request, { params }: Ctx) {
  const ownerId = request.headers.get("x-owner-id");
  const id = parseId((await params).id);
  if (!ownerId || id === null) return bad("Bad request");

  const convo = await pool.query(
    "SELECT id, title, language, created_at FROM conversations WHERE id = $1 AND owner_id = $2",
    [id, ownerId]
  );
  if (convo.rowCount === 0) return bad("Not found", 404);

  const messages = await pool.query(
    "SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at, id",
    [id]
  );

  return NextResponse.json({ ...convo.rows[0], messages: messages.rows });
}

// UPDATE the title
export async function PATCH(request: Request, { params }: Ctx) {
  const ownerId = request.headers.get("x-owner-id");
  const id = parseId((await params).id);
  if (!ownerId || id === null) return bad("Bad request");

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 100) return bad("Title must be 1 to 100 characters");

  const { rows } = await pool.query(
    "UPDATE conversations SET title = $1 WHERE id = $2 AND owner_id = $3 RETURNING id, title",
    [title, id, ownerId]
  );
  if (rows.length === 0) return bad("Not found", 404);

  return NextResponse.json(rows[0]);
}

// DELETE a conversation (its messages are removed by ON DELETE CASCADE)
export async function DELETE(request: Request, { params }: Ctx) {
  const ownerId = request.headers.get("x-owner-id");
  const id = parseId((await params).id);
  if (!ownerId || id === null) return bad("Bad request");

  const result = await pool.query(
    "DELETE FROM conversations WHERE id = $1 AND owner_id = $2",
    [id, ownerId]
  );
  if (result.rowCount === 0) return bad("Not found", 404);

  return NextResponse.json({ ok: true });
}