# Mobile release handoff — version 0.2.0

## Current status

The playable web build and native source projects are implemented. **No APK, AAB, IPA, signed archive, TestFlight build, Play testing release, or store listing has been submitted.** Android SDK tooling is absent, and this Linux environment has neither Xcode nor CocoaPods. A generated native project is not evidence of a successful device build.

The game now renders ten animated, volumetric GLB characters through Three.js / WebGL 2. The grimoire is a 3D leather book with curved page meshes and projected touch targets; summoned creatures render over the camera feed. Hand landmarks position the view. Spatial AR world anchoring, depth occlusion, and headset stereo rendering remain separate work. Validate WebGL 2 support and GPU memory on every supported device; there is no silent 2D model fallback.

## Android

1. Install current Android Studio, JDK 21, Android SDK Platform 36, and matching build tools. The project uses AGP 8.10.1 and Gradle 8.11.1. Verify support against current tooling before release.
2. Run `npm ci` and `npm run mobile:sync`. Set the SDK location in the ignored `android/local.properties`, or use your normal Android SDK environment configuration.
3. Open `android/` in Android Studio or run `cd android && ./gradlew assembleDebug` for a development APK. Run on at least two physical phones, including a lower-memory device.
4. Replace `com.battlemonsters.mobile` if your organization needs another application ID. Use your own upload keystore and Play App Signing. Keep keystores and passwords outside source control.
5. Build a signed Android App Bundle with Android Studio’s Generate Signed Bundle workflow. Confirm the then-current Play target API, 16 KB memory-page requirements for all native dependencies, supported devices, and release requirements.
6. Complete Play Console app content, Data safety, content rating, privacy URL, support contact, screenshots, app icon, and feature graphic. No Play account or contact details were supplied, so these account-specific values are not fabricated.
7. Run an internal/closed test track and complete any required testing before production submission.

Camera and microphone permissions are declared; camera and microphone hardware are optional. Android speech service visibility is declared. The default app icon and splash have been replaced with game branding. Local backup is disabled to match local-only save behavior.

## iOS

1. Use a Mac with a currently accepted version of Xcode, iOS SDK, and CocoaPods. Confirm Apple’s current submission SDK requirements.
2. Run `npm ci`, `npm run mobile:sync`, then `npx cap open ios`. If necessary, run `pod install` in `ios/App/` on that Mac.
3. Select your Apple Developer team, confirm a unique bundle identifier, configure signing, and increase the build number for subsequent uploads. Marketing version is `0.2.0` and build number is `2`.
4. Inspect the included camera, microphone, and speech-recognition descriptions in `Info.plist`. Check the privacy manifest and all transitive dependency manifests against actual required-reason API use. The included privacy declarations are a draft for this development configuration and need release review.
5. Build and test on physical iPhones and an iPad, including permission refusal and later revocation, backgrounding, small screens, notches, camera orientation, speech availability, slow model downloads, and low-power mode.
6. Archive, validate, upload to App Store Connect, and distribute through TestFlight before requesting App Review. Supply your privacy policy URL, support URL, review contact, rating, device screenshots, export declarations, and final privacy questionnaire.

Neither developer account was connected, so signing and submission remain with the app owner.

## AI release integration

The private website can call its same-origin Worker after server keys are configured. The bundled native app works with built-in personalities immediately. To enable live AI in a store release:

1. Deploy a production backend reachable by native apps over HTTPS, with real per-user authentication. The private Sites access gate is not a substitute for native app login.
2. Integrate secure short-lived user sessions into the client and authorize requests on the server. Store tokens using platform secure storage; do not bundle a shared secret or provider API key.
3. Configure allowed native origins (`capacitor://localhost` on iOS and `https://localhost` on Android as applicable), durable limits, request budgets, provider credentials, supported models, and abuse handling.
4. Replace the controlled native-token hook with real session validation and configure the API origin. Perform live tests against all three providers, including unavailable models, budget exhaustion, timeout, and invalid credentials.
5. Review user-generated content and AI response safeguards, retention, age suitability, and all provider policies for the chosen audience. Finalize disclosures from actual production behavior.

## Device acceptance run

| Area | Acceptance |
| --- | --- |
| First launch | All screens load without a key; built-in companion chat works |
| Bestiary | Ten correct animated GLB meshes and distinct stats; search, filters, profile tabs, orbit/pinch/reset |
| 3D rendering | Continuous smooth geometry, materials, resting scale, idle clips, camera fit, shadows, single shared context, no model overlap with dialogs/navigation |
| Battle scene | Both characters share a 3D arena; lunge, counterattack, signature projectile, guard and result overlays |
| Summoning | Each of ten names selects the correct active companion |
| Camera | Permission granted/denied/revoked, no camera, rear camera, open-palm stability, 3D book follows hand, projected name targets, summoned creature and recall |
| Model download | Slow connection and CDN failure show a useful message; manual grimoire remains usable |
| Voice | All ten spoken names, recognition errors, no speech service, microphone refusal, cancellation |
| Battle | All skills, energy limits, status effects, victory, defeat, retreat, rewards exactly once |
| Progress | Save after relaunch; quests claim once; reset confirmation and complete clearing |
| Layout | Small Android, large Android, small iPhone, notched iPhone, iPad; portrait and landscape |
| Accessibility | Focus navigation, meaningful labels, contrast, reduced motion, text scaling, touch targets |
| Privacy | Camera stops on navigation/background; no frame upload; voice/AI disclosures match traffic |
| Packaging | Release build, signing, current SDKs, icons, launch, no development URLs, no embedded secrets |

Automated DOM tests do not replace these physical-device checks.
