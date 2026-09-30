// Instagram: resolves the shortcode to a media id and asks the same-origin web API for file URLs.
// Falls back to whatever plain <img>/<video src> the post already exposes.
(function (root) {
  const lib = typeof require !== 'undefined' ? require('../lib/pick.js') : root.SQAB;
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const IG_APP_ID = '936619743392459';

  function shortcodeToId(shortcode) {
    const sc = shortcode.length > 28 ? shortcode.slice(0, -28) : shortcode;
    let id = 0n;
    for (const c of sc) id = id * 64n + BigInt(ALPHA.indexOf(c));
    return id.toString();
  }

  function parseMediaInfo(json, prefer) {
    const root0 = json && json.items && json.items[0];
    if (!root0) return [];
    const meta = { site: 'instagram', author: root0.user && root0.user.username, id: root0.code };
    const medias = root0.carousel_media && root0.carousel_media.length ? root0.carousel_media : [root0];
    const items = [];
    for (const m of medias) {
      const video = m.video_versions && lib.pickBestVideo(
        m.video_versions.map((v) => ({ ...v, content_type: 'video/mp4' })),
        prefer
      );
      if (video) {
        items.push({ url: video.url, type: 'video', ext: 'mp4', meta });
        continue;
      }
      const img = lib.pickLargestImage(m.image_versions2 && m.image_versions2.candidates);
      if (img) items.push({ url: img.url, type: 'image', ext: 'jpg', meta });
    }
    return items;
  }

  function shortcodeFor(post) {
    const link = post.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"]');
    const re = /\/(?:p|reel|reels)\/([\w-]+)/;
    const m = (link && link.getAttribute('href').match(re)) || location.pathname.match(re);
    return m && m[1];
  }

  function domFallback(post) {
    const meta = { site: 'instagram', author: undefined, id: shortcodeFor(post) || String(Date.now()) };
    const video = post.querySelector('video[src]:not([src^="blob:"])');
    if (video) return [{ url: video.src, type: 'video', ext: 'mp4', meta }];
    const imgs = [...post.querySelectorAll('img')].filter((i) => i.naturalWidth >= 300);
    const cands = imgs.flatMap((i) => lib.parseSrcset(i.srcset).concat([{ url: i.src, width: i.naturalWidth }]));
    const best = lib.pickLargestImage(cands);
    return best ? [{ url: best.url, type: 'image', ext: 'jpg', meta }] : [];
  }

  async function resolve(post, ctx) {
    const code = shortcodeFor(post);
    if (code) {
      try {
        const res = await fetch('https://www.instagram.com/api/v1/media/' + shortcodeToId(code) + '/info/', {
          credentials: 'include',
          headers: { 'x-ig-app-id': IG_APP_ID },
        });
        if (res.ok) {
          const items = parseMediaInfo(await res.json(), ctx && ctx.quality);
          if (items.length) return items;
        }
      } catch (e) {
        /* fall through to DOM */
      }
    }
    const items = domFallback(post);
    if (!items.length) throw new root.SQAB.Unsupported('Could not find downloadable media in this post');
    return items;
  }

  function findPosts(doc) {
    const posts = [...doc.querySelectorAll('article')];
    // The Reels viewer has no <article>; use the container of each <video> that holds a Like button.
    if (/^\/reels?\//.test(location.pathname)) {
      for (const v of doc.querySelectorAll('video')) {
        let el = v.parentElement;
        for (let i = 0; el && i < 6; i++, el = el.parentElement) {
          if (el.querySelector('svg[aria-label="Like"], svg[aria-label="Unlike"]')) {
            posts.push(el);
            break;
          }
        }
      }
    }
    return posts;
  }

  const api = { shortcodeToId, parseMediaInfo };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SQAB.registerAdapter({
      name: 'instagram',
      match: (host) => /(^|\.)instagram\.com$/.test(host),
      findPosts,
      resolve,
    });
  }
})(globalThis);
