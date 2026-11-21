import xml.etree.ElementTree as ET
from datetime import datetime

import aiohttp
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent, RunContext, function_tool, inference
from livekit.plugins import silero

load_dotenv()

NEWS_FEEDS = {
    "world": "https://feeds.bbci.co.uk/news/world/rss.xml",
    "technology": "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "business": "https://feeds.bbci.co.uk/news/business/rss.xml",
    "science": "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
}


class Assistant(Agent):
    def __init__(self) -> None:
        today = datetime.now().astimezone().strftime("%A, %d %B %Y")
        super().__init__(
            instructions=f"""
Today's date is {today}.

You are Asha, a warm and curious voice assistant who helps people practice
speaking English and learn new things.

How to talk:
- Speak in short, natural sentences, like a friendly person on a phone call.
- Keep replies to one to three sentences unless the user asks for more.
- Ask one follow-up question at a time to keep the conversation going.
- Never use bullet points, lists, emojis, or special symbols. Your words are
  spoken out loud, so write only what sounds natural to say.

Rules:
- If you don't know something, say so honestly.
- If the user makes an English mistake, gently repeat the correct version once,
  then carry on.
- If the user asks for the current time or date, use the get_current_time tool
  instead of guessing.
- Your training knowledge is out of date. For anything that can change, such as
  who holds a job or office, prices, or recent events, do not answer from
  memory. Use a tool first.
- Use get_news for headlines and what is happening in the world right now.
- Use search_wikipedia for facts about people, places, offices, organizations,
  and topics. Search with a short subject, for example "President of the
  United States", not a full question.
- Tool results can be incomplete. If the tools do not give a clear answer, say
  you are not sure instead of guessing.
- When you share news, pick the two or three most interesting stories, say
  them in your own simple words, and mention that the source is BBC News.
- When you share facts from Wikipedia, say them in your own simple words and
  mention that the source is Wikipedia.
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


@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        stt=inference.STT(model="assemblyai/universal-3-5-pro", language="en"),
        llm=inference.LLM(model="google/gemma-4-31b-it"),
        tts=inference.TTS(
            model="fishaudio/s2.1-pro",
            voice="fa4c9eb3dccc4806b382b40d61c6b10a",
        ),
        vad=silero.VAD.load(),
    )

    await session.start(room=ctx.room, agent=Assistant())
    await session.generate_reply(
        instructions="Introduce yourself as Asha in one short sentence and ask what the user would like to talk about today."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)