// X / Twitter: resolves media through the public syndication endpoint (no login needed).
(function (root) {
  const lib = typeof require !== 'undefined' ? require('../lib/pick.js') : root.SQAB;

  function tweetToken(id) {
    return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
  }

  function parseTweetResult(json, prefer) {
    const meta = { site: 'x', author: json && json.user && json.user.screen_name, id: json && json.id_str };
    const items = [];
    for (const m of (json && json.mediaDetails) || []) {
      if (m.type === 'video' || m.type === 'animated_gif') {
        const best = lib.pickBestVideo((m.video_info && m.video_info.variants) || [], prefer);
        if (best) items.push({ url: best.url, type: 'video', ext: 'mp4', meta });
      } else if (m.type === 'photo' && m.media_url_https) {
        items.push({ url: m.media_url_https + '?name=orig', type: 'image', ext: 'jpg', meta });
      }
    }
    return items;
  }

  function tweetRef(article) {
    // The first status link in the article is the tweet itself (quoted tweets come later).
    const a = article.querySelector('a[href*="/status/"] time');
    const link = a && a.closest('a');
    const m = link && link.getAttribute('href').match(/^\/([^/]+)\/status\/(\d+)/);
    return m ? { author: m[1], id: m[2] } : null;
  }

  async function resolve(article, ctx) {
    const ref = tweetRef(article) || (location.pathname.match(/^\/([^/]+)\/status\/(\d+)/) || []).slice(1);
    const id = ref.id || ref[1];
    if (!id) throw new root.SQAB.Unsupported('Could not find the post id');
    const res = await fetch(
      'https://cdn.syndication.twimg.com/tweet-result?lang=en&id=' + id + '&token=' + tweetToken(id)
    );
    if (!res.ok) throw new root.SQAB.Unsupported('X refused the request (' + res.status + ')');
    const items = parseTweetResult(await res.json(), ctx && ctx.quality);
    if (!items.length) throw new root.SQAB.Unsupported('This post has no photo or video');
    return items;
  }

  const api = { tweetToken, parseTweetResult };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SQAB.registerAdapter({
      name: 'x',
      match: (host) => /(^|\.)(x|twitter)\.com$/.test(host),
      findPosts: (doc) => doc.querySelectorAll('article[data-testid="tweet"]'),
      resolve,
    });
  }
})(globalThis);
