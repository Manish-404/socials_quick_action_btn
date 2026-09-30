// End-to-end check: loads the unpacked extension into Chromium, serves a fixture X post at
// https://x.com/ via request interception, clicks the injected button and asserts that
// the background worker starts the expected download.
//
// Requires Playwright (`npm i -D playwright` or NODE_PATH pointing at it) and a Chromium binary.
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const CHROMIUM = process.env.CHROMIUM_PATH || undefined;

const POST_HTML = `<!doctype html><html><body>
  <article data-testid="tweet" style="width:400px;height:300px">
    <a href="/alice/status/111"><time>now</time></a>
    <p>hello</p>
  </article>
</body></html>`;

(async () => {
  // Local "CDN" so chrome.downloads has a reachable file.
  const cdn = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'video/mp4' });
    res.end(Buffer.from('fake-mp4-bytes'));
  });
  await new Promise((r) => cdn.listen(0, '127.0.0.1', r));
  const mediaUrl = `http://127.0.0.1:${cdn.address().port}/hi.mp4`;

  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqab-'));
  const ctx = await chromium.launchPersistentContext(userDir, {
    executablePath: CHROMIUM,
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${ROOT}`,
      `--load-extension=${ROOT}`,
      '--no-sandbox',
    ],
  });

  try {
    await ctx.route('https://x.com/**', (route) => route.fulfill({ contentType: 'text/html', body: POST_HTML }));
    await ctx.route('https://cdn.syndication.twimg.com/**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          id_str: '111',
          user: { screen_name: 'alice' },
          mediaDetails: [
            { type: 'video', video_info: { variants: [
              { content_type: 'video/mp4', bitrate: 800000, url: mediaUrl.replace('hi', 'lo') },
              { content_type: 'video/mp4', bitrate: 2000000, url: mediaUrl },
            ] } },
          ],
        }),
      })
    );

    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker');

    const page = await ctx.newPage();
    await page.goto('https://x.com/alice/status/111');

    // Button is injected exactly once, inside a closed shadow root, so assert on the host element.
    await page.waitForSelector('article .sqab-host');
    assert.equal(await page.locator('article .sqab-host').count(), 1, 'one button per post');

    // Force a DOM mutation; the button must not be duplicated.
    await page.evaluate(() => document.querySelector('article').appendChild(document.createElement('div')));
    await page.waitForTimeout(300);
    assert.equal(await page.locator('article .sqab-host').count(), 1, 'no duplicate after mutation');

    // Closed shadow root: click by position.
    const box = await page.locator('article .sqab-host').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    let item;
    for (let i = 0; i < 30 && !item; i++) {
      await page.waitForTimeout(200);
      [item] = await sw.evaluate(() => chrome.downloads.search({ orderBy: ['-startTime'], limit: 1 }));
    }
    assert.ok(item, 'a download was started');
    assert.equal(item.url, mediaUrl, 'highest-bitrate variant chosen');
    assert.match(item.filename.replace(/\\/g, '/'), /SocialDownloads\/x_alice_111\.mp4$/);
    console.log('e2e OK:', item.filename);
  } finally {
    await ctx.close();
    cdn.close();
    fs.rmSync(userDir, { recursive: true, force: true });
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
