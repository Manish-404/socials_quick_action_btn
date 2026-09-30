// Finds posts on the current site and injects one download button per post.
(function () {
  const S = globalThis.SQAB;
  const adapter = S.adapters.find((a) => a.match(location.hostname));
  if (!adapter) return;

  const ICONS = {
    idle: '<path d="M12 3v11m0 0l-4.5-4.5M12 14l4.5-4.5M5 19h14" />',
    loading: '<circle cx="12" cy="12" r="8" stroke-dasharray="36 14"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></circle>',
    done: '<path d="M5 13l4 4L19 7" />',
    error: '<path d="M12 7v6m0 4h.01" /><circle cx="12" cy="12" r="9"/>',
  };

  const SHADOW_CSS = `
    button { all: initial; box-sizing: border-box; width: 32px; height: 32px; display: flex; align-items: center;
      justify-content: center; border-radius: 50%; cursor: pointer; color: #fff; background: rgba(20,20,20,.72);
      box-shadow: 0 1px 4px rgba(0,0,0,.4); transition: transform .12s, background .12s; }
    button:hover { background: rgba(0,0,0,.9); transform: scale(1.1); }
    button:focus-visible { outline: 2px solid #4da3ff; outline-offset: 2px; }
    button[data-state="done"] { background: #1a9b4b; }
    button[data-state="error"] { background: #c0392b; }
    svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  `;

  let settings = { quality: 'best' };
  try {
    chrome.storage.sync.get({ quality: 'best' }, (s) => (settings = s));
  } catch (e) {
    /* extension context invalidated; keep defaults */
  }

  function setState(btn, state, title) {
    btn.dataset.state = state;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.querySelector('svg').innerHTML = ICONS[state];
  }

  function createButton(post) {
    const host = document.createElement('div');
    host.className = 'sqab-host';
    host.dataset.site = adapter.name;
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = '<style>' + SHADOW_CSS + '</style><button type="button"><svg viewBox="0 0 24 24"></svg></button>';
    const btn = shadow.querySelector('button');
    setState(btn, 'idle', 'Download');

    // Keep the click from reaching the site (opening the post, pausing the video, etc.).
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'dblclick']) {
      host.addEventListener(type, (e) => e.stopPropagation());
    }
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.dataset.state === 'loading') return;
      setState(btn, 'loading', 'Preparing…');
      try {
        const items = await adapter.resolve(post, settings);
        const res = await chrome.runtime.sendMessage({ type: 'download', items });
        if (!res || !res.ok) throw new Error((res && res.error) || 'Download failed');
        setState(btn, 'done', 'Saved ' + res.count + ' file' + (res.count > 1 ? 's' : ''));
        setTimeout(() => setState(btn, 'idle', 'Download'), 2500);
      } catch (err) {
        setState(btn, 'error', err.message || 'Download failed');
        setTimeout(() => setState(btn, 'idle', 'Download'), 4000);
      }
    });
    return host;
  }

  function mount(post) {
    if (post.querySelector(':scope > .sqab-host')) return;
    if (getComputedStyle(post).position === 'static') post.style.position = 'relative';
    post.appendChild(createButton(post));
  }

  let scheduled = false;
  function scan() {
    scheduled = false;
    try {
      for (const post of adapter.findPosts(document)) mount(post);
    } catch (e) {
      /* a selector failure on one site must never break the page */
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scan);
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['is-active', 'hidden'],
  });
  schedule();
})();
