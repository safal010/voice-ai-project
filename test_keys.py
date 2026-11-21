import asyncio
from dotenv import load_dotenv
from livekit import api

load_dotenv()


async def main():
    lkapi = api.LiveKitAPI()
    try:
        rooms = await lkapi.room.list_rooms(api.ListRoomsRequest())
        print("SUCCESS: credentials are valid. Rooms:", len(rooms.rooms))
    except Exception as e:
        print("FAILED:", type(e).__name__, e)
    finally:
        await lkapi.aclose()


asyncio.run(main())