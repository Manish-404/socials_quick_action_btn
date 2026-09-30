# Social Quick Download

A Manifest V3 browser extension that puts a small download button in the corner of each post, reel and short on **Instagram, YouTube, Facebook and X**. One click saves the media to `Downloads/SocialDownloads/`.

No server, no third-party API: the extension reads the media URLs the page itself uses.

## Install (Chrome / Edge / other Chromium)

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open a supported site. A round download button appears in the top-right of each post.

Settings (filename template, quality) are under the extension's **Options**.

## What works where

| Site | Photos | Videos / reels / shorts | Notes |
|------|--------|-------------------------|-------|
| X | ✅ original size | ✅ best mp4 | Public syndication endpoint; works logged out. |
| Instagram | ✅ | ✅ | Uses the same-origin web API with your session. Carousels download every slide. |
| Facebook | ✅ | ⚠️ | Play the video first; the extension grabs the CDN file it saw loading. Picks the most recent stream, so with several videos playing it may grab the wrong one. |
| YouTube | – | ⚠️ best effort | Only muxed (audio+video) formats with a plain URL, typically ≤720p. Many videos expose none and show "No direct download link". This is a limit of the no-server approach; a local yt-dlp helper would be the fix. |

Site markup changes often. Selectors live only in `src/adapters/*.js`, so a breakage is a small fix in one file.

## Layout

```
manifest.json
src/core.js            adapter registry (content-script namespace)
src/content.js         finds posts, injects the button, handles clicks
src/background.js      downloads + Facebook media-URL sniffing
src/adapters/          one file per site: findPosts() + resolve() -> [{url,type,meta}]
src/lib/               pure helpers (filename, picking variants, sniffing) — unit tested
src/options/           options page
test/unit/             node:test unit tests   (npm test)
test/e2e/              Chromium + extension test against fixture pages (npm run test:e2e)
```

## Tests

```
npm test            # unit tests, no dependencies
npm run test:e2e    # needs Playwright + Chromium
```

The e2e test serves fixture posts at the real hostnames via request interception, so it checks injection, click handling and the download request, not live site behaviour. Live behaviour on logged-in Instagram/Facebook needs a manual check.

## Responsible use

Downloading is for content you own, have permission to save, or that the creator allows you to keep for personal use. Respect creators' rights and each platform's terms of service.
