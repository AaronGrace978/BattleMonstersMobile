# Android and iOS release

The `Android and iOS release` workflow builds both platforms and publishes a GitHub development prerelease only after both native builds succeed. It runs when release configuration or the package version changes on `main`, or from **Actions → Android and iOS release → Run workflow**.

The tag is derived from `package.json` (`v0.2.0` for version `0.2.0`). A completed release is immutable: the workflow skips an existing tag. To release a changed commit, bump the app's package version, Android versionName/versionCode, and iOS marketing/build versions before committing to main. Do not move or overwrite an existing release tag.

Linux CI runs the application checks and Android compilation. macOS CI builds an iOS simulator application and an unsigned device archive / IPA. The publish job verifies that both platform manifests identify the same source commit, creates a source archive and SHA-256 checksums, and then creates the release tag at that commit.

## Signing

Signing is required by default. The version job identifies only explicitly named Android/Apple secret aliases and outputs their names, never their values. If credentials cannot be matched, the release stops before building or publishing. Common GitHub signing names are supported in addition to the BMM names below.

For a build-only validation run, select `allow_unsigned: true` and `publish_release: false` in the manual workflow form. This produces a development-signed Android APK, an unsigned AAB, a simulator app, and unsigned iOS device artifacts in Actions without publishing a release. Unsigned iOS artifacts are not installable on a normal iPhone and cannot be uploaded to TestFlight until signed.

Optional Android signing uses these GitHub Actions secrets:

- `BMM_ANDROID_KEYSTORE_BASE64`
- `BMM_ANDROID_KEYSTORE_PASSWORD`
- `BMM_ANDROID_KEY_ALIAS`
- `BMM_ANDROID_KEY_PASSWORD`

The workflow decodes the keystore to the runner's temporary directory and removes it after the build. Keys and passwords never enter source control. Android's release configuration consumes the temporary path and those secret values only when a complete signing configuration exists.

Apple signing uses `BMM_IOS_CERTIFICATE_BASE64`, `BMM_IOS_CERT_PASSWORD`, and `BMM_IOS_PROFILE_BASE64`, or recognized aliases such as `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, and `BUILD_PROVISION_PROFILE_BASE64`. The workflow validates the profile expiration and certificate match, imports the P12 into a temporary keychain, derives the team/app identifier and export method from the profile, signs the device archive, exports the IPA, and removes temporary signing material. The supplied profile controls whether the IPA is for App Store Connect, registered test devices, development, or enterprise distribution.

See MOBILE-RELEASE.md for physical-device checks and store submission requirements.
