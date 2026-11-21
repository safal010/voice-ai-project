AI Voice Chat

A real-time voice assistant you can talk to in your browser. A Python agent built with LiveKit Agents listens, thinks, and speaks back, while a Next.js web app handles the microphone, the audio visualizer, and a live transcript.

The assistant, Asha, is a friendly English-practice partner. She can check the time, read the latest BBC News headlines, and look up facts on Wikipedia.

Features
Real-time voice conversation with an AI agent
Animated audio visualizer and live agent status (listening, thinking, speaking)
Live transcript of both sides of the conversation
Mute / unmute microphone and end-call controls
Agent tools: current time, BBC News headlines, Wikipedia search
Secure token server so the LiveKit API secret never reaches the browser
How it works
Browser (Next.js)  <--audio-->  LiveKit Cloud  <--audio-->  Python agent
        |                                                       |
        +-- /api/token (signs a join token)           STT -> LLM -> TTS
The browser asks the Next.js server for a short-lived token.
The browser joins a LiveKit room with that token and streams microphone audio.
The Python agent joins the same room, turns speech into text (STT), generates a reply with a language model (LLM), and speaks it back with text-to-speech (TTS).
Tools let the agent fetch live information instead of relying on outdated model knowledge.
Tech stack
Part	Technology
Agent	Python, LiveKit Agents, Silero VAD
AI models	LiveKit Inference (speech-to-text, LLM, text-to-speech)
Frontend	Next.js, React, TypeScript
Realtime audio	LiveKit Cloud, @livekit/components-react
Project structure
voice-ai-project/
├── agent.py            # Python voice agent (personality + tools)
├── requirements.txt    # Python dependencies
├── .env                # Python secrets (not committed)
└── frontend/
    ├── app/
    │   ├── page.tsx            # Voice chat interface
    │   ├── globals.css         # Styles
    │   └── api/token/route.ts  # Creates LiveKit join tokens
    └── .env.local              # Frontend secrets (not committed)
Getting started
Prerequisites
Python 3.10 or newer
Node.js 18 or newer
A free LiveKit Cloud project (you need its URL, API key, and API secret)
1. Clone the repository
bash
git clone https://github.com/YOUR-USERNAME/voice-ai-project.git
cd voice-ai-project
2. Set up the Python agent
powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt

On macOS or Linux, activate with source venv/bin/activate instead.

Create a .env file in the project root:

LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

Download the voice-detection model once:

bash
python agent.py download-files
3. Set up the frontend
bash
cd frontend
npm install

Create frontend/.env.local with the same three values:

LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
4. Run everything

Use two terminals.

Terminal 1 (project root, virtual environment active):

bash
python agent.py dev

Terminal 2 (frontend folder):

bash
npm run dev

Open http://localhost:3000, click Start conversation, allow microphone access, and start talking.

Customizing the agent

Everything about Asha's personality lives in the instructions text in agent.py. Change her name, tone, and rules there. Tools are plain Python functions marked with @function_tool; the docstring tells the AI when to use each one.

To add a news source, add a feed address to the NEWS_FEEDS dictionary.

Security notes
Never commit .env or frontend/.env.local. Both are listed in .gitignore.
The API secret is only used on the server side (the Python agent and the Next.js token route).
Limitations
News tool reads BBC headlines and short summaries only.
Wikipedia can lag behind very recent events.
The agent's answers depend on the language model and may occasionally be wrong.
Roadmap
[ ] Deploy the frontend (Vercel) and the agent (LiveKit Cloud)
[ ] Call timer and microphone-permission error screen
[ ] Live web search tool
[ ] Multi-language support
Acknowledgements

Built while learning with the LiveKit A
