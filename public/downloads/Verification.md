# Verification — development build 0.1.0

Verified November 9, 2026.

## Passed

- Production Vite client build and bundled Worker build.
- **23 automated tests**, including all 100 player/opponent combinations across the ten-monster roster.
- Combat health and energy bounds, all five signature effects, elemental advantage, speed contribution, guard behavior, completed battle immutability, invalid moves, corrupt-save recovery, levels, and quest conditions.
- OpenAI, Ollama Cloud, and Anthropic request construction and response parsing using **mocked responses**; provider status, missing keys, unsupported origins, invalid input, sanitized provider failures, native-origin rejection, and Anthropic welcome-message normalization.
- DOM interaction journeys: summon a monster; filter bestiary; open ability tabs; finish a battle; save rewards; summon from the camera-free book; persist reduced motion; cancel an in-flight battle by retreating; claim a quest only once; converse with a built-in companion.
- Production Worker routes serve the index, both creature artwork assets, the web manifest, and API status with expected content types. Unknown asset paths return 404.
- iOS Info.plist and privacy manifest are well-formed property lists.
- Capacitor Android and iOS project generation and web/plugin synchronization. Native icon, launch image, and permission files exist.
- Hand-tracking WASM and model URLs return HTTP 200 with cross-origin access permitted.

## Not verified here

- Visual rendering and responsive behavior in a real browser. The environment exposes no `cua_repl.js` browser automation tool, so no browser preview, screenshot, or live browser test was performed. DOM tests do not calculate browser layout.
- Camera access, palm detection quality, holographic tracking, microphone permission behavior, voice accuracy, or recognition-service availability on a physical phone.
- Live AI responses, provider billing, or actual provider account/model access. No provider API credentials were supplied.
- Android compilation, installation, or signed AAB/APK. JDK 21 is present; Android SDK tooling is absent.
- iOS compilation, device installation, archive, or signing. This Linux host lacks Xcode and CocoaPods; Capacitor explicitly skipped those native build steps.
- App Store / Play Console validation, review, or publication.

See MOBILE-RELEASE.md for the remaining release work and device acceptance checks.
