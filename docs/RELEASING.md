# Android and iOS release

The `Android and iOS release` workflow builds both platforms and publishes a GitHub development prerelease only after both native builds succeed. It runs when release configuration or the package version changes on `main`, or from **Actions → Android and iOS release → Run workflow**.

The tag is derived from `package.json` (`v0.2.0` for version `0.2.0`). A completed release is immutable: the workflow skips an existing tag. To release a changed commit, bump the app's package version, Android versionName/versionCode, and iOS marketing/build versions before committing to main. Do not move or overwrite an existing release tag.

Linux CI runs the application checks and Android compilation. macOS CI builds an iOS simulator application and an unsigned device archive / IPA. The publish job verifies that both platform manifests identify the same source commit, creates a source archive and SHA-256 checksums, and then creates the release tag at that commit.

## Signing

Without distribution credentials, Android produces a development-signed test APK plus an unsigned AAB. iOS produces a simulator app, an unsigned IPA, and an unsigned Xcode archive. The unsigned iOS artifacts are not installable on a normal iPhone and cannot be uploaded to TestFlight until signed.

Optional Android signing uses these GitHub Actions secrets:

- `BMM_ANDROID_KEYSTORE_BASE64`
- `BMM_ANDROID_KEYSTORE_PASSWORD`
- `BMM_ANDROID_KEY_ALIAS`
- `BMM_ANDROID_KEY_PASSWORD`

The workflow decodes the keystore to the runner's temporary directory and removes it after the build. Keys and passwords never enter source control. Android's release configuration consumes the temporary path and those secret values only when a complete signing configuration exists.

Apple signing needs the owner's distribution certificate/private key, provisioning profile, Apple team, and export method. Supply these through your signing environment or Xcode Organizer. A signed iOS distribution pipeline must be configured for the owner's actual account and profile; this workflow deliberately does not invent Apple credentials or claim an unsigned IPA is ready for iPhone installation.

See MOBILE-RELEASE.md for physical-device checks and store submission requirements.
