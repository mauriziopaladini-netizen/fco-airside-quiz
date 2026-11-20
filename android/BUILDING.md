# Build Android APK

The release APK is built in GitHub Actions using JDK 17 and the checked-in Gradle Wrapper.

To build locally from this directory:
`./gradlew assembleRelease` (macOS/Linux) or `gradlew.bat assembleRelease` (Windows).

The unsigned release APK is written to:
`app/build/outputs/apk/release/app-release-unsigned.apk`

GitHub Actions publishes a downloadable workflow artifact for each build and attaches the APK to tagged GitHub Releases.
