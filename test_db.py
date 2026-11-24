import asyncio

from dotenv import load_dotenv

import db

load_dotenv()


async def main():
    pool = await db.connect()
    conversation_id = await db.create_conversation(pool, "test-room", "test-owner", "en")
    await db.add_message(pool, conversation_id, "user", "hello from test")
    print("Saved a message to conversation", conversation_id)
    await pool.close()


asyncio.run(main())