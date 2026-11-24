import asyncio
import sys

from dotenv import dotenv_values
from livekit import api

path = sys.argv[1] if len(sys.argv) > 1 else ".env"
v = dotenv_values(path)


async def main():
    lkapi = api.LiveKitAPI(
        url=v["LIVEKIT_URL"],
        api_key=v["LIVEKIT_API_KEY"],
        api_secret=v["LIVEKIT_API_SECRET"],
    )
    try:
        await lkapi.room.list_rooms(api.ListRoomsRequest())
        print("SUCCESS:", path)
    except Exception as e:
        print("FAILED:", path, type(e).__name__, e)
    finally:
        await lkapi.aclose()


asyncio.run(main())