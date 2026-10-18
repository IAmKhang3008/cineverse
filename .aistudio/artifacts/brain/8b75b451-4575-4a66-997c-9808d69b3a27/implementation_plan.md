# Single Tab Execution & Multi-sub 1 Re-architecture

Ensure exactly one tab opens when launching external streams across all devices, eliminate popup blocking on iOS Safari through direct user-gesture affordances, and elevate EmbedMaster to become the primary Multi-sub #1 provider across mobile and desktop.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed through interactive clarification and will guide this implementation:

- **Confirmed Decision 1 (Provider Hierarchy)**: Multi-sub #3 (EmbedMaster) becomes the new **Multi-sub #1**. The legacy Multi-sub #1 (vaplayer.ru / peachify.pro) is completely purged. Multi-sub #2 (vidsrc.tw) remains as the secondary fallback. All references and UI badges for "Multi-sub #3" are replaced with "Multi-sub #1".
- **Confirmed Decision 2 (Mobile & iPhone Ergonomics)**: In iOS Safari, browser security blocks programmatic `window.open` calls originating from timers or async promises. In addition to attempting clean automated hand-off, the countdown overlay will display a prominent, dedicated tap button (`min-h-[48px]`) with instant tactile feedback so iPhone users can reliably open the player in a single gesture if the automated timer was intercepted.
- **Confirmed Decision 3 (Tab De-duplication Strategy)**: New tabs will target a named player window (`_cineverse_player`) with an atomic timestamp debounce lock (1200ms lock). This guarantees that even if automated timers and manual clicks occur in rapid succession, the browser will only ever open or focus **one single tab**.

---

## 1. Overview & Core Concept

- **What It Does**: Unifies the stream redirection and external tab launch mechanisms in the video playback engine. When primary streams fail or when a user clicks an external player, Cineverse launches or refocuses a single dedicated playback tab without opening duplicate windows. EmbedMaster is promoted to primary position ("Multi-sub #1"), ensuring maximum compatibility with TV shows and movies.
- **Target Audience**: Mobile and desktop viewers streaming cinema titles, especially mobile Safari (iPhone/iPad) users who previously experienced blocked popups or duplicate tabs.
- **Key Value**: Zero tab spam, immediate sub-second tab launch, zero ghost tabs, and guaranteed iOS compatibility.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Auto-Switch on Unplayable Stream**:
   - If the primary stream is broken or trailer-only, the player displays a 5-second countdown overlay with the movie's backdrop.
   - The overlay informs the user: `Đang tự động chuyển sang nguồn phụ Multi-sub #1...`.
   - A high-contrast primary CTA button (`Chuyển nguồn ngay (Xs)`) is immediately available with active touch feedback (`active:scale-95`).
   - On desktop, when the timer reaches 0, exactly one tab opens to EmbedMaster (`_cineverse_player`).
   - On iOS Safari, if the automated timer is restricted by iOS popup policy, the button remains prominently visible with a clear label: `Mở trình phát trong tab mới` to allow a 1-tap launch.

2. **Manual Server Selection**:
   - In the episode and server selector below the player, the server list renders:
     - Primary Server (Vietsub / HDAudio)
     - **Multi-sub #1** (EmbedMaster with Onyx Skin, auto-play, season/episode sync)
     - **Multi-sub #2** (vidsrc.tw)
   - The obsolete "Multi-sub #3" option is completely removed.
   - Clicking a Multi-sub episode or clicking the "Nguồn phụ #1" toolbar button immediately launches the dedicated tab without duplicate windows.

### Visual Polish & iOS Mobile Ergonomics

- **Touch Hitbox Standards**: The "Mở tab ngay" action button on mobile uses a minimum height of `48px` (`min-h-[48px]`) and `px-6`, adhering to mobile touch guidelines.
- **Color Distribution (60-30-10)**:
  - Canvas: Deep obsidian background `#0d0d12` (60%).
  - Structural Panels: Translucent frosted acrylic `bg-white/5` with hairline dividers `border-white/10` (30%).
  - Accent: High-intent Cineverse crimson `#E50914` for the primary trigger (10%).
- **Anti-Slop Restraint**: Clean text metadata; no nested bordered cards; no fake system telemetry or pulsing green dots.

---

## 3. Key Product Decisions & Trade-Offs

### Root Cause Analysis: Why Two Tabs Were Opening
1. In `triggerMultiSubAuto()`, the code previously executed:
   ```ts
   const win = window.open(urlToOpen, '_blank', 'noopener,noreferrer');
   if (win && !win.closed && typeof win.closed !== 'undefined') { opened = true; }
   if (!opened) { a.click(); }
   ```
   When `noopener` is specified, modern browsers isolate the window process and return a detached or `null` reference, causing `typeof win.closed === 'undefined'` to evaluate to true. As a result, `opened` remained `false`, and the script immediately triggered `a.click()`, firing **both** `window.open` AND anchor navigation simultaneously, opening two identical tabs.
2. In addition, `useEffect` on `[currentEpisode, isMultiSub]` had an un-synchronized secondary `window.open` trigger that fired when state updated.

### Resolution
- Create a centralized, debounced window dispatcher: `openSinglePlayerTab(url: string)`.
- Use a single execution path: call `window.open(url, '_cineverse_player')` with an atomic debounce guard (`lastOpenedTimeRef` lock of 1200ms).
- Avoid parallel anchor click fallbacks in the same call stack.
- Remove redundant duplicate listeners in `useEffect`.

### Multi-sub Provider Restructuring
- **Old Structure**:
  - Multi-sub #1: vaplayer.ru / peachify.pro (legacy, often slow or restricted)
  - Multi-sub #2: vidsrc.tw
  - Multi-sub #3: EmbedMaster (high quality, Onyx skin, full series support)
- **New Structure**:
  - **Multi-sub #1**: EmbedMaster (`embedmaster.link/tv/...` or `embedmaster.link/movie/...`)
  - **Multi-sub #2**: vidsrc.tw (`vidsrc.tw/embed/...`)
  - **Multi-sub #3**: Completely eliminated.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Watch.tsx Page                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
   [Auto Countdown Timer (5s)]     [Manual Episode/Server Click]
                │                             │
                └──────────────┬──────────────┘
                               ▼
        ┌─────────────────────────────────────────────┐
        │        openSinglePlayerTab(targetUrl)       │
        │  • Atomic timestamp lock (prevents double)  │
        │  • Target: '_cineverse_player' (named tab)   │
        │  • Immediate clean single window.open       │
        └──────────────────────┬──────────────────────┘
                               ▼
                ┌─────────────────────────────┐
                │     Browser Tab Manager     │
                │ Opens exactly 1 tab to:     │
                │ embedmaster.link / vidsrc   │
                └─────────────────────────────┘
```

### Component State & Logic Refinements

1. **Episode Server Generation (`Watch.tsx`)**:
   - Update `fetchedEpisodes` population for series and movies:
     - Generate `Multi-sub #1` with EmbedMaster endpoints.
     - Generate `Multi-sub #2` with vidsrc endpoints.
     - Drop `multiSub3Data` and legacy peachify/vaplayer code paths entirely.
2. **State & Ref Synchronization**:
   - `lastOpenTimestampRef`: Tracks `Date.now()`. Rejects any opening attempts within 1200ms.
   - Synchronize `hasAutoOpenedRef` to ensure `useEffect` does not double-fire when `currentEpisode` updates.
3. **Copy & Labels**:
   - Update countdown text from `Nguồn phụ Multi-sub #3` to `Nguồn phụ Multi-sub #1`.
   - Update toolbar buttons from `Nguồn phụ #3` to `Nguồn phụ #1`.
   - Update fallback toast notifications to reflect `Multi-sub #1`.
4. **Mobile Fallback UX**:
   - Maintain the countdown visualizer with an instant-tap button designed for iOS mobile users who have popup blockers enabled.

---

## 5. Implementation Steps

1. **Refactor Server Ingestion in `src/pages/Watch.tsx`**:
   - Swap EmbedMaster data to `Multi-sub #1`.
   - Remove legacy provider code.
   - Keep `Multi-sub #2` as vidsrc.
2. **Implement Debounced Single-Tab Dispatcher in `src/pages/Watch.tsx`**:
   - Replace dual `window.open` / `a.click()` logic with a bulletproof `openSinglePlayerTab` helper using `_cineverse_player` and timestamp debounce.
3. **Update UI Texts and Action Buttons**:
   - Replace all `Multi-sub #3` strings and references in `Watch.tsx`.
   - Ensure mobile touch button is prominently styled with `min-h-[48px]`.
4. **Verification**:
   - Compile applet with `compile_applet`.
   - Test that single click only opens a single tab.
   - Test that rapid double clicks do not open multiple tabs.
