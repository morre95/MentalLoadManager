# Mobile app (Expo)

This app shares backend logic with the web frontend through `../shared`.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Optional backend URL override:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

Defaults:
- Android emulator: `http://10.0.2.2:8000`
- iOS simulator/web: `http://localhost:8000`

3. Start Expo:

```bash
npx expo start
```

If the user is not logged in, the app shows a login screen and requests credentials.
