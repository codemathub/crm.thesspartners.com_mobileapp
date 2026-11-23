# EstateFlow CRM - Mobile Application

Cross-platform React Native / Expo application built for field agents and real estate sales executives.

## Features
- **Daily Schedule & Agendas**: Site visit showings and client callbacks with one-tap Call and WhatsApp actions.
- **Inventory & Owner Logs**: Real-time property details, owner notes, and key access tracking.
- **Enquiries & Customer 360°**: Lead intake, requirement capture, and instant inventory matching.
- **Offline Resilience & Biometrics**: Face ID / Fingerprint fast login and network reconnect handling.

## Setup & Running
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start Expo development:
   ```bash
   npx expo start
   ```
3. Production build (APK / iOS):
   ```bash
   eas build --platform android --profile production
   ```

## Production Configuration
- Production API: `https://crm.thesspartners.com/api/v1`
- Configure `EXPO_PUBLIC_API_URL` in `.env.production`
