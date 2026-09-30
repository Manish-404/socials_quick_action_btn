// Pure helpers for choosing between candidate media files.
(function (root) {
  function area(v) {
    return (v.width || 0) * (v.height || 0);
  }

  // variants: [{url, bitrate?, width?, height?, content_type?}]
  // prefer: 'best' | 'smallest'
  function pickBestVideo(variants, prefer) {
    const mp4 = (variants || []).filter(
      (v) => v && v.url && (v.content_type ? v.content_type === 'video/mp4' : /\.mp4(\?|$)/.test(v.url))
    );
    if (!mp4.length) return null;
    const score = (v) => v.bitrate || area(v);
    const sorted = mp4.slice().sort((a, b) => score(b) - score(a));
    return prefer === 'smallest' ? sorted[sorted.length - 1] : sorted[0];
  }

  // candidates: [{url, width?, height?}]
  function pickLargestImage(candidates) {
    const list = (candidates || []).filter((c) => c && c.url);
    if (!list.length) return null;
    return list.slice().sort((a, b) => area(b) - area(a))[0];
  }

  // "a.jpg 320w, b.jpg 640w" -> [{url, width}]
  function parseSrcset(srcset) {
    return String(srcset || '')
      .split(',')
      .map((part) => part.trim().split(/\s+/))
      .filter((p) => p[0])
      .map(([url, desc]) => ({ url, width: desc && /w$/.test(desc) ? parseInt(desc, 10) : 0 }));
  }

  const api = { pickBestVideo, pickLargestImage, parseSrcset };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign((root.SQAB = root.SQAB || {}), api);
})(globalThis);
