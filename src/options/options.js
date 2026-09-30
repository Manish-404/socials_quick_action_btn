const DEFAULTS = { template: '{site}_{author}_{id}', quality: 'best' };
const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(DEFAULTS, (s) => {
  $('template').value = s.template;
  $('quality').value = s.quality;
});

function save() {
  const template = $('template').value.trim() || DEFAULTS.template;
  chrome.storage.sync.set({ template, quality: $('quality').value }, () => {
    $('status').textContent = 'Saved';
    setTimeout(() => ($('status').textContent = ''), 1200);
  });
}
$('template').addEventListener('change', save);
$('quality').addEventListener('change', save);
