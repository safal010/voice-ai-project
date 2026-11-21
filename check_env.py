import os
from dotenv import load_dotenv

load_dotenv()

for name in ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"]:
    value = os.getenv(name)
    print(name, "->", "MISSING" if not value else f"loaded, length {len(value)}")

print("URL starts with:", (os.getenv("LIVEKIT_URL") or "")[:6])
print("Key starts with:", (os.getenv("LIVEKIT_API_KEY") or "")[:3])