Ten animated 3D monsters, a rustic leather-and-parchment grimoire, solo battles, camera hand tracking, voice summoning, companion dialogue, and local progress.

This is a **development prerelease** for Android and iOS. Native compilation and packaging run on Linux and macOS CI; store submission and physical-device acceptance are separate steps.

### Android

- `Android-test.apk`: installable development build, signed with the development key. Allow installation from your download source. It is not Play Store signed.
- `Android-unsigned.aab`: release App Bundle for signing with the owner's upload key. If the configured Android signing secrets are present, the workflow instead includes a signed APK/AAB.

### iOS

- `iOS-signed.ipa` / `iOS-signed.xcarchive.zip`: Apple-signed files when configured signing credentials are available. Installation or App Store Connect distribution is limited by the supplied provisioning profile.
- `iOS-simulator.zip`: compiled application for Xcode Simulator on a Mac.
- `iOS-unsigned.ipa`: compiled device application; requires Apple signing before iPhone installation or TestFlight upload.
- `iOS-unsigned.xcarchive.zip`: Xcode device archive for the signing and distribution handoff.

### Source and integrity

- The source ZIP includes the web game, both native projects, all ten GLB models, the Blender generation pipeline, release workflow, and setup guides.
- `release-manifest.json` records the exact source commit and each platform's signing status.
- `SHA256SUMS.txt` contains checksums for the attached artifacts.

Built-in monster dialogue works immediately. Live OpenAI, Ollama Cloud, and Anthropic dialogue needs a configured backend; the native app's live AI path additionally needs production authentication. Camera, speech recognition, GPU behavior, and touch controls still require physical-device testing. No App Store or Play Store submission is included in this release.
