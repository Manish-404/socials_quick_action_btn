// YouTube (best effort): asks the innertube player API for muxed (audio+video) progressive
// formats that carry a plain URL. Signature-protected or split-stream formats are skipped, so
// some videos report "not available" — see README limitations.
(function (root) {
  const lib = typeof require !== 'undefined' ? require('../lib/pick.js') : root.SQAB;

  function parsePlayerResponse(json, prefer) {
    const status = json && json.playabilityStatus;
    if (!status || status.status !== 'OK') {
      return { error: (status && status.reason) || 'Video is not playable' };
    }
    const details = json.videoDetails || {};
    const meta = { site: 'youtube', author: details.author, id: details.videoId };
    const formats = ((json.streamingData && json.streamingData.formats) || [])
      .filter((f) => f.url && /^video\/mp4/.test(f.mimeType || ''))
      .map((f) => ({ url: f.url, width: f.width, height: f.height, bitrate: f.bitrate, content_type: 'video/mp4' }));
    const best = lib.pickBestVideo(formats, prefer);
    if (!best) return { error: 'No direct download link is exposed for this video' };
    return { items: [{ url: best.url, type: 'video', ext: 'mp4', meta }] };
  }

  function currentVideoId() {
    const shorts = location.pathname.match(/^\/shorts\/([\w-]{11})/);
    return shorts ? shorts[1] : new URLSearchParams(location.search).get('v');
  }

  async function resolve(post, ctx) {
    const videoId = currentVideoId();
    if (!videoId) throw new root.SQAB.Unsupported('Open the video or short first');
    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' } },
      }),
    });
    if (!res.ok) throw new root.SQAB.Unsupported('YouTube refused the request (' + res.status + ')');
    const parsed = parsePlayerResponse(await res.json(), ctx && ctx.quality);
    if (parsed.error) throw new root.SQAB.Unsupported(parsed.error);
    return parsed.items;
  }

  const api = { parsePlayerResponse };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SQAB.registerAdapter({
      name: 'youtube',
      match: (host) => /(^|\.)youtube\.com$/.test(host),
      findPosts: (doc) => [
        ...doc.querySelectorAll('ytd-reel-video-renderer[is-active]'),
        ...doc.querySelectorAll('ytd-watch-flexy:not([hidden]) #movie_player'),
      ],
      resolve,
    });
  }
})(globalThis);
