# Mobile app (Expo)

This app now shares backend logic with the web frontend through `../shared`.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure backend URL and token (recommended):

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_ACCESS_TOKEN=your_jwt_token
```

3. Start Expo:

```bash
npx expo start
```

If `EXPO_PUBLIC_ACCESS_TOKEN` is not set, the app shows a token input on the `Tasks` and `Household` tabs.
