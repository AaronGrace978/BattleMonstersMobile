# Verification — development build 0.2.0

Verified November 9, 2026.

## Passed

- All ten GLB files decode with the production Three.js GLTFLoader and Meshopt decoder. Each has volumetric bounds, smooth normals, physically based materials, over 10,000 triangles, and Idle / Attack / Summon clips. Idle playback preserves coherent resting scale. Manifest hashes and byte budgets are verified. The Khronos validator reports zero errors and warnings for every GLB; its Meshopt extension decoding is not implemented, so the production Three.js loader separately validates decoded geometry.
- All ten original creature meshes were rendered in Blender for visual inspection. These are offline asset previews, not screenshots of the browser renderer.
- UV picking tests cover all ten printed book names and reject page margins.
- The 3D scene implementation shares one WebGL context across viewports and uses scissoring, asset caching, physically based lighting, orbit/zoom controls, and frame limiting. Browser GPU execution of these paths still needs verification.

- Production Vite client build and bundled Worker build.
- **25 automated tests**, including all 100 player/opponent combinations across the ten-monster roster.
- Combat health and energy bounds, all five signature effects, elemental advantage, speed contribution, guard behavior, completed battle immutability, invalid moves, corrupt-save recovery, levels, and quest conditions.
- OpenAI, Ollama Cloud, and Anthropic request construction and response parsing using **mocked responses**; provider status, missing keys, unsupported origins, invalid input, sanitized provider failures, native-origin rejection, and Anthropic welcome-message normalization.
- DOM interaction journeys: summon a monster; filter bestiary; open ability tabs; finish a battle; save rewards; summon a 3D creature from the camera-free book; persist reduced motion; cancel an in-flight battle by retreating; claim a quest only once; converse with a built-in companion.
- Production Worker route checks cover the index, GLB assets and manifest, web manifest, source download, and API status with expected content types. Unknown paths return 404.
- iOS Info.plist and privacy manifest are well-formed property lists.
- Capacitor Android and iOS project generation and web/plugin synchronization. Native icon, launch image, and permission files exist.
- Hand-tracking WASM and model URLs return HTTP 200 with cross-origin access permitted.

## Not verified here

- WebGL shader execution, page rendering, touch orbit / pinch behavior, 3D book tap-target alignment, context recovery, and responsive behavior in a real browser. The environment exposes no `cua_repl.js` browser automation tool, so no browser preview, screenshot, or live browser test was performed. DOM tests do not calculate browser layout.
- Camera access, palm detection quality, holographic tracking, microphone permission behavior, voice accuracy, or recognition-service availability on a physical phone.
- Live AI responses, provider billing, or actual provider account/model access. No provider API credentials were supplied.
- Android compilation, installation, or signed AAB/APK. JDK 21 is present; Android SDK tooling is absent.
- iOS compilation, device installation, archive, or signing. This Linux host lacks Xcode and CocoaPods; Capacitor explicitly skipped those native build steps.
- App Store / Play Console validation, review, or publication.

See MOBILE-RELEASE.md for the remaining release work and device acceptance checks.
