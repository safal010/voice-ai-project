import asyncio
import json
import logging
import xml.etree.ElementTree as ET
from datetime import datetime

import aiohttp
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent, RunContext, function_tool, inference
from livekit.agents.llm import ChatMessage
from livekit.plugins import silero

import db

load_dotenv()

logger = logging.getLogger("asha")

# Change this to "en" or "hi" to switch Asha's language.
LANGUAGE = "en"

NEWS_FEEDS = {
    "world": "https://feeds.bbci.co.uk/news/world/rss.xml",
    "technology": "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "business": "https://feeds.bbci.co.uk/news/business/rss.xml",
    "science": "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
}

LANGUAGES = {
    "en": {
        "stt": dict(model="assemblyai/universal-3-5-pro", language="en"),
        "tts": dict(
            model="fishaudio/s2.1-pro",
            voice="fa4c9eb3dccc4806b382b40d61c6b10a",
        ),
        "persona": """
You are Asha, a warm and curious voice assistant who helps people practice
speaking English and learn new things.
Speak in short, natural English sentences.
If the user makes an English mistake, gently repeat the correct version once,
then carry on.
""",
        "greeting": "Introduce yourself as Asha in one short sentence and ask what the user would like to talk about today.",
    },
    "hi": {
        "stt": dict(model="deepgram/nova-3", language="hi"),
        "tts": dict(
            model="cartesia/sonic-3",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
            language="hi",
        ),
        "persona": """
You are Asha, a warm and curious voice assistant.
Always speak in simple, natural Hindi, written in Devanagari script, like a
friendly person on a phone call. If the user speaks English, still answer in
Hindi, and you may keep common English words that people use in everyday Hindi.
Never write Hindi in Roman letters, because your words are spoken out loud.
""",
        "greeting": "Introduce yourself as Asha in one short sentence in Hindi and ask what the user would like to talk about today.",
    },
}


class Assistant(Agent):
    def __init__(self, persona: str) -> None:
        today = datetime.now().astimezone().strftime("%A, %d %B %Y")
        super().__init__(
            instructions=f"""
Today's date is {today}.

{persona}

How to talk:
- Keep replies to one to three sentences unless the user asks for more.
- Ask one follow-up question at a time to keep the conversation going.
- Never use bullet points, lists, emojis, or special symbols. Your words are
  spoken out loud, so write only what sounds natural to say.

Rules:
- If you don't know something, say so honestly.
- If the user asks for the current time or date, use the get_current_time tool
  instead of guessing.
- Your training knowledge is out of date. For anything that can change, such as
  who holds a job or office, prices, or recent events, do not answer from
  memory. Use a tool first.
- Use get_news for headlines and what is happening in the world right now.
- Use search_wikipedia for facts about people, places, offices, organizations,
  and topics. Search with a short English subject, for example "President of
  the United States", not a full question.
- Tool results can be incomplete. If the tools do not give a clear answer, say
  you are not sure instead of guessing.
- Tool results are in English. When you share them, say them in your own simple
  words in the language you are speaking, and mention the source (BBC News or
  Wikipedia).
"""
        )

    @function_tool
    async def get_current_time(self, context: RunContext) -> str:
        """Get the current date and time. Use this when the user asks what time
        or date it is right now."""
        now = datetime.now().astimezone()
        return now.strftime("%A, %d %B %Y, %I:%M %p")

    @function_tool
    async def get_news(self, context: RunContext, topic: str = "world") -> str:
        """Get the latest news headlines. Use this whenever the user asks about
        news, current events, or what is happening in the world.

        Args:
            topic: One of "world", "technology", "business", or "science".
        """
        url = NEWS_FEEDS.get(topic.lower(), NEWS_FEEDS["world"])

        try:
            timeout = aiohttp.ClientTimeout(total=8)
            async with aiohttp.ClientSession(timeout=timeout) as http:
                async with http.get(url) as resp:
                    resp.raise_for_status()
                    xml_text = await resp.text()
        except Exception:
            return "Sorry, I could not reach the news service right now."

        root = ET.fromstring(xml_text)
        stories = []
        for item in root.findall("./channel/item")[:5]:
            title = item.findtext("title", default="").strip()
            summary = item.findtext("description", default="").strip()
            stories.append(f"{title}. {summary}")

        if not stories:
            return "I could not find any news stories right now."

        return "Latest BBC News stories:\n" + "\n".join(stories)

    @function_tool
    async def search_wikipedia(self, context: RunContext, query: str) -> str:
        """Look up facts on Wikipedia about a person, place, office,
        organization, or topic. Use this when the user asks a factual question,
        such as who someone is or who holds an office.

        Args:
            query: A short subject to search for, like "President of the United States".
        """
        params = {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": query,
            "gsrlimit": 3,
            "prop": "extracts",
            "exintro": 1,
            "explaintext": 1,
            "exlimit": 3,
        }
        headers = {"User-Agent": "AshaVoiceAgent/1.0 (learning project)"}

        try:
            timeout = aiohttp.ClientTimeout(total=8)
            async with aiohttp.ClientSession(timeout=timeout, headers=headers) as http:
                async with http.get(
                    "https://en.wikipedia.org/w/api.php", params=params
                ) as resp:
                    resp.raise_for_status()
                    data = await resp.json()
        except Exception:
            return "Sorry, I could not reach Wikipedia right now."

        pages = data.get("query", {}).get("pages", {})
        ordered = sorted(pages.values(), key=lambda p: p.get("index", 0))

        results = []
        for page in ordered:
            extract = (page.get("extract") or "").strip()
            if extract:
                results.append(f"{page['title']}: {extract[:600]}")

        if not results:
            return "I could not find anything on Wikipedia about that."

        return "Wikipedia results:\n\n" + "\n\n".join(results)


server = AgentServer()


def parse_owner_id(metadata: str | None) -> str:
    """Read the anonymous owner ID that the web page put in the visitor's token."""
    try:
        owner = json.loads(metadata or "{}").get("ownerId")
    except ValueError:
        return "anonymous"
    if isinstance(owner, str) and 8 <= len(owner) <= 64:
        return owner
    return "anonymous"


@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    cfg = LANGUAGES[LANGUAGE]

    await ctx.connect()
    owner_id = "anonymous"
    try:
        participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=10)
        owner_id = parse_owner_id(participant.metadata)
        logger.info("visitor metadata present: %s", bool(participant.metadata))
    except asyncio.TimeoutError:
        logger.warning("No visitor joined within 10 seconds")

    session = AgentSession(
        stt=inference.STT(**cfg["stt"]),
        llm=inference.LLM(model="google/gemma-4-31b-it"),
        tts=inference.TTS(**cfg["tts"]),
        vad=silero.VAD.load(),
    )

    # ---- Save the conversation to PostgreSQL ----
    # If the database is down, Asha still talks; she just doesn't save.
    pool = None
    conversation_id = None
    try:
        pool = await db.connect()
        conversation_id = await db.create_conversation(
            pool, ctx.job.room.name, owner_id, LANGUAGE
        )
    except Exception:
        logger.exception("Database unavailable, this conversation will not be saved")

    if conversation_id is not None:
        queue: asyncio.Queue = asyncio.Queue()

        async def writer():
            # One worker saves messages one by one, so they stay in order.
            while True:
                role, content = await queue.get()
                try:
                    await db.add_message(pool, conversation_id, role, content)
                except Exception:
                    logger.exception("Could not save a message")
                finally:
                    queue.task_done()

        writer_task = asyncio.create_task(writer())

        @session.on("conversation_item_added")
        def on_item_added(ev):
            item = ev.item
            if not isinstance(item, ChatMessage):
                return
            if item.role not in ("user", "assistant"):
                return
            text = (item.text_content or "").strip()
            if text:
                queue.put_nowait((item.role, text))

        async def cleanup():
            try:
                await asyncio.wait_for(queue.join(), timeout=5)
            except asyncio.TimeoutError:
                pass
            writer_task.cancel()
            await pool.close()

        ctx.add_shutdown_callback(cleanup)

    await session.start(room=ctx.room, agent=Assistant(cfg["persona"]))
    await session.generate_reply(instructions=cfg["greeting"])


if __name__ == "__main__":
    agents.cli.run_app(server)