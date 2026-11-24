import os

import asyncpg


async def connect() -> asyncpg.Pool:
    """Open a pool of database connections using DATABASE_URL."""
    return await asyncpg.create_pool(os.environ["DATABASE_URL"], min_size=1, max_size=3)


async def create_conversation(pool, room_name: str, owner_id: str, language: str) -> int:
    """CREATE: add a conversation (or reuse it if the room already exists)."""
    return await pool.fetchval(
        """
        INSERT INTO conversations (room_name, owner_id, language)
        VALUES ($1, $2, $3)
        ON CONFLICT (room_name) DO UPDATE SET room_name = EXCLUDED.room_name
        RETURNING id
        """,
        room_name,
        owner_id,
        language,
    )


async def add_message(pool, conversation_id: int, role: str, content: str) -> None:
    """CREATE: add one message to a conversation."""
    await pool.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)",
        conversation_id,
        role,
        content,
    )