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

### ~~US-003~~: ~~Add an Epic Games store connection~~ _(removed)_
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

### ~~US-012~~: ~~Epic Games library via API~~ _(removed)_
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

### US-018: Community score column in list view
**As a** user,
**I want** to see the community score alongside each game in list view, with a live loading indicator while scores are being fetched,
**So that** I can quickly compare scores without opening each game.

**Acceptance criteria:**
- [ ] List view is the default view mode
- [ ] A score column is visible on every list row
- [ ] While metadata is being fetched for a game, a small spinner is shown in the score column
- [ ] Once fetched, the score is shown as a coloured percentage badge (green ≥70%, orange 40–69%, red <40%)
- [ ] If metadata is unavailable (e.g. Epic games), '?' is shown
- [ ] The score column updates live as background fetches complete — no page reload needed

---

### US-019: Per-connection colour accent in list view
**As a** user,
**I want** each store connection to have a distinct colour shown as a thin vertical line before the game name,
**So that** I can instantly see which store a game comes from while browsing the list.

**Acceptance criteria:**
- [ ] Each connection is assigned a stable colour from a predefined palette
- [ ] A thin coloured bar appears on the left edge of every list row
- [ ] Colours are consistent across renders for the same connection

---

### US-020: Configurable concurrent metadata fetching
**As a** developer,
**I want** the number of concurrent background metadata fetches to be configurable and set to 10,
**So that** the library populates quickly without flooding Steam with hundreds of sequential requests.

**Acceptance criteria:**
- [ ] Background metadata fetches run concurrently up to a configurable limit (default: 10)
- [ ] The metadata rate limiter is removed from `getAppMetadata`; Steam's 429 responses are handled by the existing retry operator
- [ ] Diagnostic log entries are emitted for each metadata response (app-details name/image, review score)
- [ ] Log entry is emitted when metadata is applied to a game in the library

---

### US-021: Game detail view handles non-Steam games gracefully
**As a** user,
**I want** the game detail view to show an appropriate message for non-Steam games when no metadata is available,
**So that** I am not shown a "Load metadata from Steam" button that silently does nothing.

**Acceptance criteria:**
- [ ] The "Load metadata from Steam" button is only shown for Steam games
- [ ] For non-Steam games with no metadata, a static note "No Steam metadata available for this game." is shown instead
- [ ] For non-Steam games that already have metadata (e.g. Epic cover image), neither the button nor the note is shown

---

### US-022: Steam metadata enrichment for non-Steam games
**As a** user,
**I want** the app to automatically search Steam for a matching game title and fetch its metadata for my Epic (and other non-Steam) games,
**So that** I can see community scores, cover art, and tags for games regardless of where I bought them.

**Acceptance criteria:**
- [ ] After a sync, non-Steam games are searched on the Steam Store by title in the background
- [ ] If an exact title match is found, metadata is fetched automatically and applied to the game
- [ ] If no exact match is found, the top Steam candidates are stored and surfaced in the game detail view
- [ ] In the game detail, the user can select the correct Steam entry from the candidates list to load its metadata
- [ ] Confirmed matches (user-selected or auto-matched) are cached permanently so re-syncs don't re-search
- [ ] Search results (candidates) are cached for 24 hours
- [ ] Background search respects the same concurrency limit as Steam metadata fetching

---

### US-023: GOG library connection
**As a** user,
**I want** to connect my GOG account so my GOG library is imported into Gamesync,
**So that** I can see all my GOG games alongside Steam and GOG titles.

**Acceptance criteria:**
- [ ] User can add a GOG connection via the "Add store connection" dialog
- [ ] Clicking "Open GOG Login" opens the GOG OAuth login page in a new tab
- [ ] After logging in, user copies the `code` from the browser URL bar and pastes it into the dialog
- [ ] The backend exchanges the code for an access + refresh token using GOG's public OAuth client
- [ ] GOG games are fetched and displayed in the library with name, hours played, and cover image
- [ ] The access token is refreshed automatically when expired
- [ ] Since GOG provides playtime data, hours played is shown correctly (in hours, rounded to 1 decimal)

---

### US-009: Successful build required
**As a** developer,
**I want** every change to produce a passing production build,
**So that** the application is always in a deployable state.

**Acceptance criteria:**
- [ ] The project has a production build configuration (`ng build`)
- [ ] The build completes without errors before a change is considered done

---

### US-024: Dropdown styling
**As a** user,
**I want** all dropdown menus to have a solid dark background,
**So that** options are readable against the dark app theme.

**Acceptance criteria:**
- [ ] Sort-by dropdown in the library has a solid dark background
- [ ] All `mat-select` panels across the app use a consistent dark background
- [ ] Selected and hovered options are visually distinct

---

### US-025: Persist games across syncs
**As a** user,
**I want** my game library to persist between syncs and be updated incrementally,
**So that** a sync that partially fails doesn't wipe out games I've already loaded.

**Acceptance criteria:**
- [ ] Games from a previous sync remain visible while a new sync is in progress
- [ ] After a successful sync, games from that connection are replaced with the fresh list
- [ ] Games from connections that errored during sync are left unchanged

---

### US-026: Non-fatal connection errors during sync
**As a** user,
**I want** a failing store connection to not block the rest of my sync,
**So that** I still see games from my working connections even if one fails.

**Acceptance criteria:**
- [ ] If one connection fails, games from other connections are still fetched and shown
- [ ] A snackbar informs the user that some connections failed
- [ ] Games already loaded from the failed connection remain visible

---

### US-027: Open Steam store page from game details
**As a** user,
**I want** to click a game's cover image in the detail view to open its Steam store page,
**So that** I can quickly visit the store page to read reviews or buy DLC.

**Acceptance criteria:**
- [ ] Clicking the cover image opens the Steam store page in a new tab
- [ ] The link is only shown/active when a Steam store URL is available
- [ ] A visible cursor and hover effect indicate the image is clickable
