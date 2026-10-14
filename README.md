This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.js`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.js`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.

# AI Dialogue Scene Generator

Create short dramatic dialogue scenes and turn them into spoken audio using **Google Gemini**, **Gemini Text-to-Speech**, and **LangGraph**.

This is a **Next.js** web application. Describe a scene, choose voices for its speakers, and generate a script with character names, emotions, pacing, and audio. You can save scenes locally and load them again later.

## Features

- **Prompt-to-dialogue:** Generate a scene from a written description.
- **Character details:** AI-generated character names, roles, and scene mood.
- **Expressive dialogue:** Each line includes an emotion, pace, and intensity.
- **Voice selection:** Assign a Gemini voice and acting direction to each speaker.
- **Audio generation:** Generate speech with Gemini TTS; the app supports one, two, or more speakers through different generation paths.
- **Local scene library:** Save, list, load, and delete scenes, including generated WAV audio when available.
- **Reuse existing scenes:** Load a previously saved scene instead of regenerating it. Use **Force Regenerate** when you want a fresh result.

## Technology

- Next.js 16 (Pages Router) and React 19
- Google Gemini via `@google/genai`
- LangGraph for the generation workflow
- Zod for validating generated dialogue
- Local JSON and WAV files for storage

## Getting started

### 1. Requirements

Install **Node.js** (a version compatible with Next.js 16; Node.js 20.9+ is required) and npm. You will also need a Google AI Studio API key with access to the Gemini models used by this project.

### 2. Clone and install

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
cd YOUR-REPOSITORY
npm install
```

Replace the example GitHub URL and directory with your repository's actual details.

### 3. Configure your API key

Create a `.env` file in the project root:

```env
GOOGLE_API_KEY=your_google_ai_studio_api_key
```

Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).

**Important:** Never commit your `.env` file or real API key to GitHub. The project already includes `.env*` in `.gitignore`.

### 4. Start the application

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

## How to use

1. **Enter a scene name** so you can find it again later.
2. **Describe the scene** — for example: *“Two villagers help each other escape a volcanic eruption.”*
3. **Configure speakers:** choose each speaker's ID, Gemini voice, and optional acting direction.
4. Click **Generate** to create the dialogue and audio.
5. Review the script, character details, and audio playback.
6. Use **Save**, **Load**, or **Delete** to manage your local scene library. Select **Force Regenerate** to request a new version of an existing scene.

Generating dialogue and audio makes API requests to Google and may incur usage costs. Reusing a saved scene avoids regenerating it.

## How it works

```text
Scene description + speaker settings
                 |
                 v
         LangGraph workflow
                 |
          Gemini dialogue
                 |
        Zod validation
                 |
           Gemini TTS
                 |
      WAV audio + scene JSON
                 |
          Local storage
```

The graph generates structured dialogue first, then routes it to the appropriate speech-generation path. For more than two speakers, it generates smaller audio segments and combines them into a WAV file.

## Project structure

```text
pages/
  index.js                   # Main user interface
  api/
    voice.js                 # Available voice options
    scene/
      generate.js            # Generate or reuse a scene
      save.js                # Save a scene
      get.js                 # Load a scene
      list.js                # List saved scenes
      delete.js              # Delete a scene
lib/
  gemini.js                  # Gemini dialogue generation
  ttsGemini.js               # Gemini speech generation
  voices.js                  # Voice choices
  wav.js                     # WAV audio utilities
  sceneStore.js              # Local scene storage
  graph/
    sceneGraph.js            # LangGraph workflow
    schemas.js               # Dialogue validation
styles/                       # Application styles
data/scenes/                  # Saved scene JSON and WAV files
```

## Saved files

Scenes are stored in `data/scenes/`. Each saved scene has its own folder, typically containing:

```text
data/scenes/example-scene/
  scene.json
  audio.wav
```

The `data/scenes/index.json` file maintains the scene list. This is **local filesystem storage**, not a database. It is best suited to running the app locally or on a server with persistent writable storage. It is not a ready-made solution for stateless hosting.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the application for production |
| `npm start` | Run the production build |

## Troubleshooting

| Issue | What to check |
| --- | --- |
| Missing API key | Make sure `.env` contains `GOOGLE_API_KEY` and restart the server. |
| Gemini authentication error | Check the API key and whether the configured Gemini models are accessible. |
| Invalid dialogue output | Review the backend console for Zod validation errors. |
| Missing speaker voice | Ensure the generated speaker IDs match the configured speakers. |
| Save returns HTTP 413 | The WAV audio may make the JSON request too large; review the API body size limit. |
| Saved scenes disappear after deployment | Confirm the hosting environment provides persistent writable storage. |

## Notes for contributors

The project currently uses these models in its source code:

- Dialogue: `gemini-2.5-flash`
- Speech: `gemini-2.5-flash-preview-tts`

You can change the models in `lib/gemini.js` and `lib/ttsGemini.js`, provided the replacements support the required operations. Voice and emotion rendering depend on the model's behavior and may vary between generations.

Before opening a pull request, check that the app starts, scene generation works, and scenes can be saved and loaded.

## License

No license is specified in this repository yet. Add a `LICENSE` file if you want to define how others may use, modify, and distribute this project.

