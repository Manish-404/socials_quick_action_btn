importScripts('lib/filename.js', 'lib/sniff.js');

const { buildFilename, DEFAULT_TEMPLATE, normalizeMediaUrl, isAudioOnly } = globalThis.SQAB;
const FOLDER = 'SocialDownloads/';
const MAX_SNIFFED = 20;

// Remember recent media files each tab requested from Facebook's CDN (per-tab, survives worker restarts).
chrome.webRequest.onResponseStarted.addListener(
  async (details) => {
    if (details.tabId < 0 || !/\.mp4$/.test(new URL(details.url).pathname) || isAudioOnly(details.url)) return;
    const key = 'sniff:' + details.tabId;
    const store = await chrome.storage.session.get(key);
    const list = (store[key] || []).filter((e) => e.url !== normalizeMediaUrl(details.url));
    list.push({ url: normalizeMediaUrl(details.url), t: Date.now() });
    await chrome.storage.session.set({ [key]: list.slice(-MAX_SNIFFED) });
  },
  { urls: ['*://*.fbcdn.net/*'], types: ['media', 'xmlhttprequest', 'other'] }
);

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove('sniff:' + tabId));

async function download(items) {
  const { template } = await chrome.storage.sync.get({ template: DEFAULT_TEMPLATE });
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    await chrome.downloads.download({
      url: items[i].url,
      filename: FOLDER + buildFilename(template, items[i], i, items.length),
      conflictAction: 'uniquify',
    });
    count++;
  }
  return count;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'download') {
    download(msg.items).then(
      (count) => sendResponse({ ok: true, count }),
      (err) => sendResponse({ ok: false, error: String(err && err.message || err) })
    );
    return true; // async response
  }
  if (msg.type === 'getSniffed') {
    const key = 'sniff:' + (sender.tab && sender.tab.id);
    chrome.storage.session.get(key).then((s) => sendResponse(s[key] || []));
    return true;
  }
});
