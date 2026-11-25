AI Voice Chat

A real-time voice assistant you can talk to in your browser. A Python agent built with LiveKit Agents listens, thinks, and speaks back, while a Next.js web app handles the microphone, the audio visualizer, a live transcript, and a saved conversation history backed by PostgreSQL.

Live demo: voice-ai-project-ten.vercel.app

The agent sleeps when idle. The first conversation after a quiet period can take 1 to 2 minutes to wake up.

Screenshot

The assistant, Asha, is a friendly English-practice partner. She can check the time, read the latest BBC News headlines, and look up facts on Wikipedia.

Features
Real-time voice conversation with an AI agent
Animated audio visualizer and live agent status (listening, thinking, speaking)
Live transcript of both sides of the conversation
Mute / unmute microphone and end-call controls
Agent tools: current time, BBC News headlines, Wikipedia search
Conversation history saved in PostgreSQL with full CRUD: view past conversations, open them, rename them, and delete them
Per-browser privacy: each visitor only sees their own conversations (anonymous owner ID, no login required)
Language setting in the agent (English, with Hindi support available)
Secure token server so the LiveKit API secret never reaches the browser
If the database is down, voice chat still works
How it works
Browser (Next.js)  <--audio-->  LiveKit Cloud  <--audio-->  Python agent
   |                                                           |
   +-- /api/token (join token + owner ID)        STT -> LLM -> TTS
   |                                                           |
   +-- /api/conversations (CRUD)  <--  PostgreSQL (Neon)  <----+
                                         saves messages
The browser asks the Next.js server for a short-lived token. The token carries an anonymous owner ID as metadata.
The browser joins a LiveKit room with that token and streams microphone audio.
The Python agent joins the same room, turns speech into text (STT), generates a reply with a language model (LLM), and speaks it back with text-to-speech (TTS).
Every message is saved to PostgreSQL by the agent, tagged with the owner ID.
The History view in the web app lists, opens, renames, and deletes only the conversations that belong to the current browser.
Tech stack
Part	Technology
Agent	Python, LiveKit Agents, Silero VAD
AI models	LiveKit Inference (speech-to-text, LLM, text-to-speech)
Frontend	Next.js, React, TypeScript
Realtime audio	LiveKit Cloud, @livekit/components-react
Database	PostgreSQL (local for development, Neon in production)
DB drivers	asyncpg (Python agent), pg (Next.js API routes)
Hosting	Vercel (frontend), LiveKit Cloud (agent)
Project structure
voice-ai-project/
├── agent.py             # Python voice agent (personality, tools, saves messages)
├── db.py                # Database helpers for the agent (asyncpg)
├── requirements.txt     # Python dependencies
├── Dockerfile           # Used by LiveKit Cloud to build the agent
├── livekit.toml         # LiveKit Cloud agent configuration
├── .env                 # Python secrets (not committed)
└── frontend/
    ├── app/
    │   ├── page.tsx                       # Voice chat + History interface
    │   ├── globals.css                    # Styles
    │   └── api/
    │       ├── token/route.ts             # Creates LiveKit join tokens
    │       └── conversations/
    │           ├── route.ts               # List conversations
    │           └── [id]/route.ts          # Read, rename, delete one conversation
    ├── lib/
    │   ├── db.ts                          # PostgreSQL connection pool
    │   └── owner.ts                       # Validates the anonymous owner ID
    └── .env.local                         # Frontend secrets (not committed)
Database schema
sql
CREATE TABLE conversations (
  id          SERIAL PRIMARY KEY,
  room_name   TEXT UNIQUE NOT NULL,
  owner_id    TEXT NOT NULL,
  title       TEXT,
  language    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
  id               SERIAL PRIMARY KEY,
  conversation_id  INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conversations_owner ON conversations (owner_id, created_at DESC);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);

Deleting a conversation also deletes its messages (ON DELETE CASCADE). All queries are parameterized.

Getting started
Prerequisites
Python 3.10 or newer
Node.js 18 or newer
PostgreSQL (local install with pgAdmin, or a free Neon database)
A free LiveKit Cloud project (you need its URL, API key, and API secret)
1. Clone the repository
bash
git clone https://github.com/safal010/voice-ai-project.git
cd voice-ai-project
2. Create the database

Create a database (for example voice_ai_chat) and run the SQL from the Database schema section above, for example in pgAdmin's Query Tool.

3. Set up the Python agent
powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt

On macOS or Linux, activate with source venv/bin/activate instead.

Create a .env file in the project root:

LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
DATABASE_URL=postgresql://user:password@localhost:5432/voice_ai_chat

If your password contains special characters such as @, URL-encode them in the connection string.

Download the voice-detection model once:

bash
python agent.py download-files
4. Set up the frontend
bash
cd frontend
npm install

Create frontend/.env.local:

LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
DATABASE_URL=postgresql://user:password@localhost:5432/voice_ai_chat
5. Run everything

Use two terminals.

Terminal 1 (project root, virtual environment active):

bash
python agent.py dev

Terminal 2 (frontend folder):

bash
npm run dev

Open http://localhost:3000, click Start conversation, allow microphone access, and start talking. Open History to see saved conversations.

Deployment
Frontend (Vercel): import the GitHub repository and set the Root Directory to frontend. Add LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and DATABASE_URL as environment variables. With Neon, use the pooled connection string here.
Agent (LiveKit Cloud): install the LiveKit CLI, run lk cloud auth, then deploy with lk agent create --secrets-file agent-secrets.env (first time) or lk agent deploy (updates). The secrets file holds DATABASE_URL and is never committed. With Neon, use the direct (non-pooled) connection string for the agent.
Customizing the agent

Everything about Asha's personality lives in the instructions text in agent.py. Change her name, tone, and rules there. Tools are plain Python functions marked with @function_tool; the docstring tells the AI when to use each one.

To add a news source, add a feed address to the NEWS_FEEDS dictionary. To change the language, edit LANGUAGE at the top of agent.py.

Security notes
Never commit .env, frontend/.env.local, or agent-secrets.env. All three are listed in .gitignore. Run git status before every push.
The API secret and database URL are only used on the server side (the Python agent and the Next.js API routes).
Conversations are filtered by an anonymous per-browser owner ID. This keeps visitors' histories separate but is not real authentication; anyone who has your ID can read your history. Real login is on the roadmap.
The app stores what visitors say. The page shows a notice, and old conversations should be cleaned up periodically.
Limitations
News tool reads BBC headlines and short summaries only.
Wikipedia can lag behind very recent events.
History is tied to one browser; clearing site data loses access to it.
The agent's answers depend on the language model and may occasionally be wrong.


Acknowledgements

Built while learning with the LiveKit Agents documentation and starter projects.
