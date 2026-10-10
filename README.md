# Car Wash Staff

React Native (Expo SDK 57 + Expo Router + TypeScript) app for car wash staff, built on the
[Car Wash Management API](https://65-1-30-38.nip.io/api/docs/).

## What staff can do

| Feature | Screen | API |
| --- | --- | --- |
| Log in / log out, auto token refresh | `login`, Profile | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` |
| Reset a forgotten password with a 6-digit code (dev servers also accept `1111`) | `forgot-password` | `POST /auth/forgot-password`, `/auth/reset-password` |
| Change your password; forced on first sign-in when an owner set it | `change-password`, Profile | `POST /auth/change-password` |
| See services with private & taxi rates; add a service; open one to edit name, rates, duration, or deactivate/reactivate | Services tab → service details | `GET/POST /services`, `PATCH/DELETE /services/{id}` |
| **New wash** on one screen: enter mobile → returning customer's name + cars shown (single car auto-picked), or fill new customer / car inline (number as KL · 07 · AB · 1234 or typed manually; brand → model pickers set the body type) → pick service → Start | **New wash** | `GET /customers?search`, `GET /vehicles?customerId`, then (if new) `POST /customers`, `POST /vehicles`, then `POST /bookings` → `POST /orders` |
| Finance report: revenue, wash count, average, taxi share, by service and by day, plus the completed washes — filtered by date (today, yesterday, 7 days, this/last month, custom), service, and private/taxi | Reports tab (needs `REPORTS_VIEW`) | `GET /orders?status=COMPLETED` (summed on the device — the API has no date-range report) |
| Check in cars from existing bookings | Jobs → *To check in* | `GET /bookings`, `POST /orders` |
| Move a job along: Checked in → Washing → Ready → **Completed**, or cancel | Jobs tab, Job details | `GET /orders`, `PATCH /orders/{id}` |
| Add users and assign each one a role; edit, suspend/deactivate, reset password, remove | Team → Users | `/users`, `/users/{id}/status`, `/users/{id}/reset-password` |
| View roles; add/remove permissions (built-in roles are changed for your car wash only, with reset to default); create custom roles | Team → Roles & permissions | `/roles`, `POST /roles/{id}/reset`, `GET /permissions` |

Each wash is marked **Private** or **Taxi**, which picks the rate. Separate taxi rates need a small
backend change — see [docs/backend-taxi-rates.md](docs/backend-taxi-rates.md). Until it ships, taxis are
charged the regular rate and flagged “Taxi” in the booking notes; the app switches over automatically.

Branding and currency come from `GET /app/config`. The app hides buttons and tabs
the user's role doesn't allow (based on `permissions` from `/auth/me`). For example, the
`STAFF` role can't view reports or cancel bookings, and doesn't see the Team tab.
Matching the server's rules, you can only assign roles or grant permissions you hold
yourself, you can't change your own role's permissions, and you can't change your own role or status.

## Run it

```bash
npm install
npx expo start          # scan the QR code with Expo Go (Android/iOS)
npx expo start --android
```

To point it at another server, copy `.env.example` to `.env` and change `EXPO_PUBLIC_API_URL`.

> **Web:** `npx expo start --web` works in development. The API server doesn't allow browser
> (CORS) requests from other origins, so in the web dev build the app calls `/__api/...` on the
> Expo dev server, and `metro.config.js` forwards those requests to the API. Native builds call
> the API directly. A production web deployment needs CORS enabled on the server, or its own proxy.

## Production APK

Release builds are shrunk with R8 (`expo-build-properties`), ship only ARM code (`armeabi-v7a`,
`arm64-v8a` — real phones, no emulator ABIs), and are signed with the release key in `credentials/`
via [plugins/withReleaseSigning.js](plugins/withReleaseSigning.js).

```bash
npx expo prebuild --platform android --clean   # regenerate android/ from app.json
cd android && ./gradlew assembleRelease        # → android/app/build/outputs/apk/release/app-release.apk
```

`credentials/` (`release.jks` + `keystore.properties`) is gitignored. **Back it up somewhere safe** —
every future update must be signed with the same key, or phones will refuse to install it over the
existing app. Bump `version` in `app.json` (and `android.versionCode`) for each release you hand out.

## Project layout

```
src/
  api/          client.ts (fetch, bearer auth, refresh-token rotation), index.ts (endpoints), types.ts
  auth/         AuthContext – session, /auth/me, /app/config, can(permission)
  app/          Expo Router routes
    login.tsx, forgot-password.tsx
    (app)/(tabs)/  index (Jobs), reports, services, profile
    (app)/order/[id].tsx   job details + status workflow
    (app)/wash/new.tsx     one-screen New wash: mobile → customer & car (pick or add) → service → start
    (app)/(tabs)/team.tsx  users & roles lists
    (app)/user/new.tsx, user/[id].tsx   add / manage a user and their role
    (app)/role/[id].tsx    view, create ("new") or edit a role's permissions
    (app)/service/[id].tsx view, create ("new") or edit a service and its rates
  components/   UI kit, OrderCard, theme
  hooks/        useQuery (focus refetch, pull-to-refresh), useDebounced
  lib/          formatting, status metadata, confirm dialogs, secure storage, plates (state codes),
                vehicleCatalog (brands → models → body type), report (finance report maths)
```

Checks: `npx tsc --noEmit` · `npx expo lint` · `npx expo-doctor`
