// Facebook: images come straight from the DOM; videos play from blob: URLs, so the background
// worker sniffs the real fbcdn file URL from network traffic and we pick the most recent one.
(function (root) {
  const lib = typeof require !== 'undefined' ? require('../lib/pick.js') : root.SQAB;

  function metaFor(post) {
    const link = post.querySelector('a[href*="/reel/"], a[href*="/videos/"], a[href*="/posts/"]');
    const m = link && link.getAttribute('href').match(/\/(?:reel|videos|posts)\/(\d+)/);
    const who = post.querySelector('h2 a, h3 a, h4 a, strong a');
    return { site: 'facebook', author: who && who.textContent.trim(), id: (m && m[1]) || String(Date.now()) };
  }

  async function resolve(post) {
    const meta = metaFor(post);
    const video = post.querySelector('video');
    if (video) {
      if (video.src && !video.src.startsWith('blob:')) return [{ url: video.src, type: 'video', ext: 'mp4', meta }];
      const entries = await chrome.runtime.sendMessage({ type: 'getSniffed' });
      const hit = lib.pickSniffed(entries);
      if (!hit) throw new root.SQAB.Unsupported('Press play on the video first, then click download');
      return [{ url: hit.url, type: 'video', ext: 'mp4', meta }];
    }
    const cands = [...post.querySelectorAll('img')]
      .filter((i) => i.naturalWidth >= 300)
      .map((i) => ({ url: i.src, width: i.naturalWidth, height: i.naturalHeight }));
    const best = lib.pickLargestImage(cands);
    if (!best) throw new root.SQAB.Unsupported('No photo or video found in this post');
    return [{ url: best.url, type: 'image', ext: 'jpg', meta }];
  }

  const api = { metaFor };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SQAB.registerAdapter({
      name: 'facebook',
      match: (host) => /(^|\.)facebook\.com$/.test(host),
      findPosts: (doc) => {
        const posts = [...doc.querySelectorAll('div[role="article"]')].filter(
          (p) => !p.parentElement.closest('div[role="article"]') // skip comments nested in a post
        );
        if (/^\/(reel|watch)\b/.test(location.pathname)) {
          for (const v of doc.querySelectorAll('video')) {
            let el = v;
            for (let i = 0; el.parentElement && i < 4; i++) el = el.parentElement;
            posts.push(el);
          }
        }
        return posts;
      },
      resolve,
    });
  }
})(globalThis);
