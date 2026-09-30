// Pure helpers for media URLs the background worker observes on the network.
// Used for sites (Facebook) whose <video> elements play from blob: URLs.
(function (root) {
  function decodeB64(s) {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    return typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64').toString('utf8') : atob(b64);
  }

  // fbcdn URLs carry an `efg` param: base64 JSON whose vencode_tag says what the stream is.
  function isAudioOnly(url) {
    try {
      const efg = new URL(url).searchParams.get('efg');
      if (!efg) return false;
      return /audio/i.test(JSON.parse(decodeB64(efg)).vencode_tag || '');
    } catch (e) {
      return false;
    }
  }

  // DASH players fetch byte ranges; dropping the range params yields the whole file.
  function normalizeMediaUrl(url) {
    try {
      const u = new URL(url);
      u.searchParams.delete('bytestart');
      u.searchParams.delete('byteend');
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  // entries: [{url, t}] oldest first -> most recent entry that is not audio-only, or null.
  function pickSniffed(entries) {
    const usable = (entries || []).filter((e) => e && e.url && !isAudioOnly(e.url));
    return usable.length ? usable[usable.length - 1] : null;
  }

  const api = { isAudioOnly, normalizeMediaUrl, pickSniffed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign((root.SQAB = root.SQAB || {}), api);
})(globalThis);
