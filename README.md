# Battle Monsters Mobile

A playable, responsive monster battler with a holographic grimoire. Version **0.1.0**, a development build with Android and iOS source projects. This is not a signed store release.

## Run

Requires Node 22 or later and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. To produce the bundled web app and Sites-compatible Worker:

```sh
npm run build
npm test
```

The playable client is in `web/`. The deployable server is `dist/server/index.js`, with its hosting manifest in `dist/.openai/hosting.json`. The build embeds assets in the Worker, so no separate asset binding is required. `vite dev` serves the client; live companion API routes are available on the deployed Worker, not the Vite development server.

## Play

1. Choose a monster in the **Monster book**. View its stats, story, and abilities; tap **Summon** to make it your companion.
2. Open the **Battle arena**, choose your opponent, and enter. Strike adds 1 energy. Guard adds 2 energy, restores up to 8 HP, and reduces the next incoming hit by 55%. Your signature move costs 2 energy. Elemental advantage adds 30% damage; higher speed gives up to a further 10% damage bonus. Rival monsters use their signature move every third turn.
3. A victory awards 150 essence and 100 XP. A completed defeat awards 40 essence and 35 XP. Every 250 XP advances your shared summoner bond. Claim one-time quest rewards from the sanctuary or the bell.
4. In **Summoning**, use the camera to show an open palm. A MediaPipe model detects landmarks locally and places the book over your palm. Tap any name, or choose **Voice summon** and say “Summon Pyrax.” The preview and tap controls work without camera access.
5. Chat with your companion. Built-in, contextual dialogue works immediately without credentials. Select a configured provider in **Settings** for live generative dialogue.

All ten monsters are available from the beginning. Essence is a progression counter in this build; there are no purchases, upgrades, or monetization. Progress saves in browser local storage on this device. Bond level is shared; individual stats do not scale with XP.

## What is implemented

- Ten original creature portraits, custom Pyrax key art, unique stat combinations, lore, elements, personalities, and signature moves.
- Responsive sanctuary, bestiary search and rarity filters, creature detail tabs, companion chat, solo arena, rewards, quests, saved preferences, and sound effects.
- Open-palm camera detection and tracking; holographic **2D** book overlay and a camera-free preview. Runtime and model download on first use.
- Web Speech recognition in supported browsers; native speech-recognition plugin in Android and iOS projects. Tap controls remain available on every platform.
- Server-side OpenAI, Ollama Cloud, and Anthropic adapters with provider status, input validation, request timeouts, error handling, and per-isolate rate limiting.
- Capacitor native projects, original app icons and launch artwork, permission descriptions, Android target API 36, and an iOS privacy manifest draft.

## Important boundaries

This is a single-player 2D game and camera overlay, not a spatial VR game. There are no rigged 3D monster models, depth occlusion, ARKit/ARCore anchors, headsets, multiplayer, accounts, cloud saves, purchases, or store submissions. The creature artwork is rendered imagery; it is not a set of animated 3D assets. The AI companions generate dialogue only; the deterministic battle engine controls combat.

Browser visual QA, physical camera/voice behavior, and signed native builds have not been verified in this environment. See [the release guide](docs/MOBILE-RELEASE.md) for the concrete steps to a production release.

## AI server

Set secrets in the deployment platform’s server environment. Never place them in `VITE_` variables, mobile preferences, the app bundle, or source control.

| Provider | Key | Optional model variable | Default model |
| --- | --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` | `gpt-4.1-mini` |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` |
| Ollama Cloud | `OLLAMA_API_KEY` | `OLLAMA_MODEL` | `gpt-oss:120b` |

Redeploy after setting the server secrets, then choose a provider in Settings. Model availability depends on the provider and your account. The adapters were tested with mocked provider responses; no live requests were made without credentials. This Sites deployment is private and relies on the platform’s access gate for web API access. Its URL is not a public production API for a store app.

For a native production app, deploy the API with authenticated user sessions, quotas, and a secure login/token flow, and set its HTTPS origin in Settings. The included Worker rejects unauthenticated native-origin chat requests. `NATIVE_ALLOWED_ORIGIN` and the server-side `NATIVE_API_TOKEN` are provided only as infrastructure hooks for a controlled backend integration; the game deliberately has no token-entry field and ships no shared secret. Do not embed a server credential or shared AI token into the store app. A production authentication integration is still required for native live AI. Built-in personalities work in the bundled native app without it.

For a production AI endpoint, replace per-isolate rate limits with durable per-user limits, configure budget caps, review provider retention settings, and finalize the privacy policy and appropriate audience/content handling.

## Native projects

```sh
npm run mobile:sync
npm run mobile:android
# On a Mac with current Xcode and CocoaPods:
npm run mobile:ios
```

The existing `android/` and `ios/` directories are checked in; do not run `cap add` again. Use `cap sync` after changing client source or plugins. Native builds use the locally bundled `web/` output, rather than loading the private website in a WebView. Camera frames are not sent to an AI provider. Native and browser speech services can process voice remotely.

`scripts/brand-native.mjs` regenerates native branding if ImageMagick is installed. Existing raster icons are included, so running it is optional.

## Source map

| Path | Purpose |
| --- | --- |
| `src/main.jsx`, `src/style.css` | Playable UI and device features |
| `src/game.mjs` | Monster catalog, battle engine, local dialogue, save validation |
| `src/speech.mjs` | Web/native speech helpers |
| `server/api.mjs` | Provider routing and server-only credentials |
| `scripts/build-worker.mjs` | Web assets and Worker packaging |
| `tests/` | Engine, API, UI journey, and asset checks |
| `docs/` | Release, verification, privacy, and store draft materials |
| `android/`, `ios/` | Native source projects |

Artwork was generated specifically for this game. Creature names and branding are original working names and require normal trademark clearance before commercial publication. Npm dependencies retain their own licenses. Review third-party and model terms before release.
