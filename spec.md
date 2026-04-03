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
