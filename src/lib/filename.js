// Pure helpers for building download filenames. Also loaded by the background worker.
(function (root) {
  const DEFAULT_TEMPLATE = '{site}_{author}_{id}';

  function sanitize(s) {
    return String(s == null ? '' : s)
      // eslint-disable-next-line no-control-regex
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^[._]+|[._]+$/g, '')
      .slice(0, 100);
  }

  function extFromUrl(url, type) {
    try {
      const m = new URL(url).pathname.match(/\.([a-z0-9]{2,4})$/i);
      if (m && /^(mp4|webm|mov|jpg|jpeg|png|webp|gif)$/i.test(m[1])) return m[1].toLowerCase();
    } catch (e) {
      /* fall through */
    }
    return type === 'video' ? 'mp4' : 'jpg';
  }

  // item: {url, type, ext?, meta:{site, author, id}}; index/count used to number multi-media posts.
  function buildFilename(template, item, index, count, now) {
    const meta = item.meta || {};
    const d = (now || new Date()).toISOString().slice(0, 10);
    const vars = { site: meta.site, author: meta.author, id: meta.id, date: d };
    let name = String(template || DEFAULT_TEMPLATE).replace(/\{(\w+)\}/g, (_, k) => sanitize(vars[k]));
    name = sanitize(name.replace(/_{2,}/g, '_')) || 'download';
    if (count > 1) name += '_' + (index + 1);
    return name + '.' + (item.ext || extFromUrl(item.url, item.type));
  }

  const api = { DEFAULT_TEMPLATE, sanitize, extFromUrl, buildFilename };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign((root.SQAB = root.SQAB || {}), api);
})(globalThis);
