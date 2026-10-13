# Covey

Covey is a minimal, family-focused calendar that brings your iCloud calendars into beautifully designed interface that can live anywhere in your home. It can run locally on a computer or server or can be added to a tablet Home Screen like an app. No third party services or subscriptions needed. 

## Features

- Month and week calendar views
- Create, update, and delete events in iCloud Calendar
- Optional reminders and dinner calendars
- Sync status indicator with offline and retry states
- Light and dark themes, including scheduled theme changes
- Multiple color palettes and adjustable text size
- Calendar visibility filters
- Preferences saved in the browser
- Minimal interface that fades secondary controls when idle
- Time-aware Today Mode with event-start animation and optional household sounds
- Swipeable Today, Calendar, and Tasks pages with a compact floating page control
- Optional screen wake lock for counter-mounted Android displays
- Responsive layout for desktop and mobile devices
- App icon, launch splash screen, and iOS Home Screen support
- Open-source project designed to run on your own infrastructure

## Calendars

Covey comes with support for three calendars out of the box. A family calendar for all family activity, dinner calendar to track meals and reminders calendar for general family reminders.

In the future we will be adding support for separate individual calendars. 

## Requirements

- Node.js 20.6 or newer
- An iCloud account
- An Apple app-specific password

## iCloud setup

Covey connects to iCloud using CalDAV. Apple requires an app-specific password for third-party applications; your normal Apple ID password will not work.

1. Sign in to [appleid.apple.com](https://appleid.apple.com).
2. Open **Sign-In and Security**.
3. Select **App-Specific Passwords**.
4. Generate a password for Covey and save it somewhere secure.

You will use your Apple ID email address and this generated password in Covey's environment configuration.

## Installing

Install via Github by downloading this package to your device or by using npm.

via git clone:
``` git clone https://github.com/vinceangeloni/Covey/ ```

via npm:
``` npm install covey-calendar ```

## Configuration

After installing dependencies, run the setup wizard:

```sh
npm run setup
```

The wizard asks for your Apple ID email, an app-specific password (the input is masked), and the name of an existing iCloud calendar for events. Reminders and dinner calendars are optional. It saves the credentials to `.env` with owner-only file permissions. Use an app-specific password, not your normal Apple ID password; create one at [account.apple.com](https://account.apple.com/).

You can also run `npm start` without configuring credentials first. Covey detects missing iCloud credentials, launches the setup wizard in the terminal, and starts the server after setup completes. If `.env` already exists, the wizard asks before updating iCloud settings and preserves unrelated entries. To configure Covey without an interactive terminal, copy `.env_sample` to `.env` and edit it manually. Never commit `.env` or share your app-specific password.

Calendar names entered during setup must match calendars that already exist in iCloud. The event calendar defaults to `Family`; confirm or change it to match your account. Covey creates `data/calendars.json` on first launch. It contains calendar IDs, iCloud calendar names, and types (`event`, `reminder`, or `dinner`). Legacy `CALENDAR_NAME`, `REMINDERS_CALENDAR`, and `DINNER_CALENDAR` values in `.env` seed this file only on first launch. The generated `data/` directory is ignored by Git so each installation keeps its own settings.

The Calendars tab lets you add calendars by name, choose from eight preset colors and icons, and confirm the calendar already exists in iCloud. Covey also checks the name with iCloud before saving. Calendar records are persisted in `data/calendars.json`; direct file edits require a server restart. The config API's `PUT /api/config/calendars` replaces the full list, so include every calendar you want to keep. Calendar names must match existing iCloud calendars (case-insensitive). To store the file somewhere else, set `COVEY_DATA_DIR` to a writable directory. Never commit `.env` or share your app-specific password.

## Running locally

Install dependencies and start the server. On first launch, `npm start` opens setup if iCloud credentials are missing:

```sh
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

The server reads `.env` at startup. If you change your configuration, stop and restart Covey.

Covey's server runtime can also be embedded by another host, including the
Covey Server macOS app. `createCoveyRuntime()` accepts credentials and explicit
data and asset directories without reading `.env` or terminating the host
process. Manual installations can optionally set `COVEY_DATA_DIR`,
`COVEY_ASSETS_DIR`, `COVEY_HOST`, and `PORT`; the defaults preserve the existing
`npm start` behavior.

The server exposes `GET /api/health` for process health and `GET /api/status`
for non-secret runtime status. These endpoints do not contact iCloud or return
account credentials.

For development, run:

```sh
npm run dev
```

Open the local URL shown in the terminal (normally [http://localhost:5173](http://localhost:5173)). Front-end changes refresh the browser automatically, and changes to the server restart it automatically. If that port is already occupied, Covey selects the next available one.

## Building a standalone server runtime

Covey can assemble a platform-specific server artifact that does not require a
separate Node.js or npm installation:

```sh
npm run build:server
npm run verify:server
```

The artifact is written to `artifacts/covey-server-<platform>-<architecture>`
and contains:

- `covey-server`, the launcher;
- `bin/node`, the private Node.js runtime;
- `server.cjs`, the bundled server and production dependencies;
- `public/`, the compiled Covey web client; and
- `manifest.json`, runtime and version metadata.

Artifacts are built for the platform and processor running the build. Manual
npm installations continue to use `.env` and `npm start`.

## Building the macOS host

On macOS with Xcode installed, build the menu bar host and its private server
runtime with:

```sh
npm run build:macos
```

The resulting development app is written to `artifacts/Covey Server.app`. On
first launch it walks through iCloud setup, stores the Apple ID email and
app-specific password in macOS Keychain, and starts Covey Server only after
setup is complete. It reports status from the menu bar, opens the calendar in
the default browser, and stores application data in
`~/Library/Application Support/Covey Server`. The bundle includes its own Node.js
runtime, so people using the app do not need Node or npm installed.

Covey Server listens on the Mac's local network so household devices on the
same Wi-Fi can connect. Use **Copy address** in the menu bar to copy the Mac's
current network URL. macOS may ask for permission to accept incoming network
connections the first time a new development build runs.

This phase produces an ad-hoc signed development build rather than a notarized
DMG. Environment credentials remain available as a development fallback, and a
manual npm installation remains fully supported alongside the app.

## How it works

Covey is a small Node.js application:

- `server.js` runs the Express web server and exposes the calendar API.
- `server-entry.js` launches the server for manual npm installations.
- `server-artifact-entry.js` prepares paths for the standalone runtime.
- `runtime-config.js` translates environment variables into the shared server runtime contract.
- `scripts/build-server-artifact.js` assembles the bundled server, web client, and private Node runtime.
- `scripts/build-macos-app.js` compiles and assembles the native macOS app bundle.
- `macos/` contains the SwiftUI menu bar host that supervises the private server process.
- `task-store.js` validates and atomically persists household tasks with revision-based conflict protection.
- `calendar-store.js` validates and persists per-install calendar configuration in `data/calendars.json`.
- `tsdav` handles CalDAV communication with iCloud.
- `ical.js` parses and generates iCalendar data.
- `index.html` contains the web application UI.
- `style.css` contains the shared stylesheet.

Calendar events are read from and written to iCloud through the server. The browser does not connect directly to iCloud.

## Local household tasks

Covey Server is the source of truth for household tasks. Tasks are stored in
`data/tasks.json` for manual installations, or in the data directory supplied
by a packaged host. The versioned store uses owner-only permissions, atomic
writes, deletion tombstones, and monotonically increasing revisions so clients
can request incremental changes and detect stale updates.

The initial task API is:

- `GET /api/tasks` or `GET /api/tasks?since=<revision>`;
- `POST /api/tasks`;
- `PUT /api/tasks/:id`;
- `POST /api/tasks/:id/complete`;
- `POST /api/tasks/:id/reopen`; and
- `DELETE /api/tasks/:id?revision=<revision>`.

Task updates, completion, reopening, and deletion require the client's last
known task revision. A stale mutation receives `409 Conflict` and the current
task so one household device cannot silently overwrite another. Task UI and
recurrence are intentionally deferred until the shared data contract has been
exercised by the server and future clients.

## Privacy and local storage

Covey does not provide a separate hosted account system. The iCloud credentials configured in `.env` are used by the server to access the configured calendars.

Interface preferences—such as theme, text size, selected view, and calendar visibility—are stored in your browser's `localStorage`. These preferences remain local to that browser and are not uploaded to Covey.

Your calendar data remains in iCloud, subject to Apple's account and calendar settings.

## Add Covey to a Home Screen

Run Covey on a computer or server your mobile device can reach, then open it in the device's browser.

- **iPhone or iPad:** In Safari, choose **Share → Add to Home Screen**.
- **Android:** In Chrome, open the menu and choose **Install app** or **Add to Home screen**.

Covey includes iOS icons and an Android web app manifest with 192×192 and 512×512 icons. For Android's full app-style installation, serve Covey over HTTPS (or use `localhost` on the device).

## Open source

Covey is open source and intended to be self-hosted and adapted to your needs. Contributions, fixes, and ideas are welcome.

Project repository: [github.com/monster-party/Covey](https://github.com/monster-party/Covey)
## License

Covey is licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html). You may use, modify, and redistribute Covey under the terms of that license. If you modify Covey and make it available to users over a network, you must also make the corresponding source code available under the same license.

Contact the project maintainers if you need a separate commercial license without the AGPL requirements.
