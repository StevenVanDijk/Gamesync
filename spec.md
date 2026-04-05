# Specification

This file contains user stories for the Gamesync project. Every change must be represented here as a user story before implementation begins.

## User Stories

---

### US-001: View game library
**As a** user,
**I want** to see all my games in a single library view,
**So that** I can browse my entire collection regardless of which store I bought them from.

**Acceptance criteria:**
- [ ] Library page displays all games from all connected stores
- [ ] Each game card shows at minimum the game name and cover image
- [ ] Library is searchable/filterable

---

### US-002: Add a Steam store connection
**As a** user,
**I want** to connect my Steam account using my Steam API key and Steam ID,
**So that** my Steam library is automatically imported into Gamesync.

**Acceptance criteria:**
- [ ] User can enter a Steam API key and Steam ID
- [ ] Connection is saved and persisted across sessions
- [ ] Games from Steam are fetched and displayed in the library

---

### US-003: Add an Epic Games store connection
**As a** user,
**I want** to connect my Epic Games account,
**So that** my Epic library is imported into Gamesync.

**Acceptance criteria:**
- [ ] User can configure an Epic Games connection
- [ ] Games from Epic are listed in the library

---

### US-004: View hours spent playing a game
**As a** user,
**I want** to see how many hours I have spent playing each game,
**So that** I know which games I engage with most.

**Acceptance criteria:**
- [ ] Hours played is shown on the game card and game detail page
- [ ] Data is sourced from the connected store (e.g. Steam playtime)

---

### US-005: View Steam metadata for a game
**As a** user,
**I want** to see rich metadata for each game (community score, cover image, year published, tags),
**So that** I can make informed decisions about what to play next.

**Acceptance criteria:**
- [ ] Community score (Steam review score) is displayed
- [ ] Cover/header image is displayed
- [ ] Year of publication is displayed
- [ ] Tags/genres are displayed
- [ ] Metadata is sourced from the Steam Store API

---

### US-006: Steam API rate limiting
**As a** developer,
**I want** the Steam API integration to respect rate limits and cache responses,
**So that** we do not DOS Steam and avoid being throttled or banned.

**Acceptance criteria:**
- [ ] Requests are queued and spaced with a configurable delay
- [ ] Responses are cached locally (localStorage) with a TTL
- [ ] Cache hits bypass the network entirely

---

### US-007: Install as a PWA
**As a** user,
**I want** to install Gamesync on my device as a Progressive Web App,
**So that** I can access it quickly like a native app.

**Acceptance criteria:**
- [ ] App has a valid Web App Manifest (name, icons, theme colour)
- [ ] Service worker is registered for offline support
- [ ] App is installable from a supported browser

---

### US-008: Manage store connections
**As a** user,
**I want** to view, edit, and remove my store connections,
**So that** I can keep my connected accounts up to date.

**Acceptance criteria:**
- [ ] Connections list page shows all configured connections
- [ ] User can delete a connection
- [ ] Deleting a connection removes its games from the library

---

### US-010: App renders correctly on mobile devices
**As a** user,
**I want** the app to display icons and a usable layout on my phone,
**So that** I can manage my game library on a mobile screen.

**Acceptance criteria:**
- [ ] Material icons render as icons, not as raw text ligatures
- [ ] The top toolbar fits on a narrow (≤ 400 px) screen without overflow
- [ ] The library controls (search, sort, sync) stack vertically on mobile
- [ ] The game grid adapts to a single column on small screens

---

### US-013: In-app sync log viewer
**As a** user,
**I want** to see a log of sync activity and errors in the app itself,
**So that** I can diagnose problems without opening browser DevTools.

**Acceptance criteria:**
- [ ] A dedicated Logs screen lists all sync log entries (info, warn, error)
- [ ] Each entry shows its timestamp, severity level, and message
- [ ] Error entries are visually distinct (red)
- [ ] A badge on the Logs nav link shows the number of unseen errors
- [ ] The user can clear all log entries
- [ ] Logs are readable on mobile

---

### US-012: Epic Games library via API
**As a** user,
**I want** to connect my Epic Games account using OAuth so my library is automatically imported,
**So that** I don't have to manually export and paste JSON.

**Acceptance criteria:**
- [ ] User can click "Open Epic Login" in the connections dialog to sign in with Epic
- [ ] After signing in, the user copies the authorizationCode from Epic's redirect page and pastes it into the dialog
- [ ] The backend exchanges the code using Epic Launcher's public OAuth client (no developer app registration required)
- [ ] Owned games are fetched from Epic's library service and displayed in the library
- [ ] Unreal Engine assets, private sandbox items, and plugins/extras are filtered out
- [ ] Since Epic provides no playtime data, hours played is shown as 0
- [ ] The connection stores the Epic account ID (not raw credentials)

---

### US-011: Backend proxy for Steam API (CORS-free)
**As a** developer,
**I want** a Node.js/Express backend to proxy Steam API requests,
**So that** the browser client never makes cross-origin Steam calls and CORS errors are eliminated.

**Acceptance criteria:**
- [ ] Express app exposes `GET /api/steam/owned-games`, `GET /api/steam/app-details`, and `GET /api/steam/reviews/:appid`
- [ ] The backend is deployable as a Vercel serverless function
- [ ] The Angular frontend routes all Steam calls through the backend proxy
- [ ] Integration tests cover the three proxy routes (happy path + error forwarding)

---

### US-016: List view for game library
**As a** user,
**I want** a list view option in the library that shows one game per row,
**So that** I can scan many titles quickly without visual noise from images.

**Acceptance criteria:**
- [ ] A third toggle button adds "list" mode alongside card and compact
- [ ] List rows show a small thumbnail, game title, and hours played
- [ ] Rows are space-efficient (≈ 40 px tall)
- [ ] List view works on both mobile and desktop

---

### US-015: Automatic metadata loading with caching
**As a** user,
**I want** game metadata (cover image, score, tags) to appear automatically in my library,
**So that** I can browse visually without having to open each game individually.

**Acceptance criteria:**
- [ ] After a sync, any previously cached metadata is applied to game cards immediately
- [ ] Steam games without cached metadata are fetched in the background automatically
- [ ] Background fetches are paced through the rate limiter so Steam is not flooded
- [ ] Metadata is stored in localStorage permanently (no expiry)
- [ ] Background fetch failures are silently ignored (do not affect the library view)

---

### US-014: Compact grid view in library
**As a** user on a mobile device,
**I want** to switch to a compact grid layout in the library,
**So that** I can browse many games at once without large empty image placeholders dominating the screen.

**Acceptance criteria:**
- [ ] A toggle button in the library header switches between "card" view and "compact" view
- [ ] Compact view shows 3 columns on mobile and more on wider screens
- [ ] Compact cards have a smaller image area and omit tags and year
- [ ] Card view remains the default
- [ ] The toggle is visible on mobile without breaking the header layout

---

### US-017: Resilient metadata fetching (429 retry + permanent cache)
**As a** user,
**I want** the app to handle Steam rate-limiting responses gracefully and never re-fetch data it already has,
**So that** my library populates reliably even when Steam throttles requests.

**Acceptance criteria:**
- [ ] When Steam returns HTTP 429, the request is retried up to 3 times with exponential back-off (2 s, 4 s, 8 s)
- [ ] Non-429 errors are not retried
- [ ] Game metadata is cached permanently in localStorage (no TTL expiry)
- [ ] A cache hit always bypasses the network, even after the app restarts

---

### US-009: Successful build required
**As a** developer,
**I want** every change to produce a passing production build,
**So that** the application is always in a deployable state.

**Acceptance criteria:**
- [ ] The project has a production build configuration (`ng build`)
- [ ] The build completes without errors before a change is considered done
