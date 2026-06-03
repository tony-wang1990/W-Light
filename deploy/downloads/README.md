# App Downloads

Put mobile release artifacts here when publishing an internal test build.

The Docker web service mounts this directory to `/usr/share/nginx/html/downloads`, so files placed here are served by the deployed Web container, for example:

- `http://SERVER_IP:3005/downloads/w-light-latest.apk`
- `http://SERVER_IP:3005/downloads/w-light-android.json`

Do not commit real APK/AAB/IPA files or signing keys to Git.
