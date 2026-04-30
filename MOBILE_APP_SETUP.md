# Data Vista Mobile App Setup

This project is configured with Capacitor so the existing Vite/React app can be packaged as an Android app.

## Requirements

- Android Studio
- Java/JDK from Android Studio or a standalone JDK
- `JAVA_HOME` set and `java` available in PATH

## Environment

For Android builds, keep the normal Vite variables and set the API base URL to the deployed Vercel app:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=https://your-vercel-app.vercel.app
VITE_ML_API_URL=https://your-datavista-ml-service.onrender.com
```

`VITE_API_BASE_URL` is needed because a packaged mobile app cannot call Vercel serverless functions with a relative `/api/...` URL.

## Common Commands

Build the web app and sync it into Android:

```powershell
npm run cap:sync
```

Open the Android project in Android Studio:

```powershell
npm run cap:android
```

Build a debug APK after Java is installed:

```powershell
npm run cap:apk
```

The debug APK is created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

For a Play Store build, open Android Studio and create a signed release AAB from Build > Generate Signed App Bundle / APK.
