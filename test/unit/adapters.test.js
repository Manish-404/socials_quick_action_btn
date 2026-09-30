const test = require('node:test');
const assert = require('node:assert/strict');
const twitter = require('../../src/adapters/twitter.js');
const instagram = require('../../src/adapters/instagram.js');
const youtube = require('../../src/adapters/youtube.js');

test('twitter: parses video, gif and photo media', () => {
  const json = {
    id_str: '111',
    user: { screen_name: 'alice' },
    mediaDetails: [
      { type: 'video', video_info: { variants: [
        { content_type: 'application/x-mpegURL', url: 'https://v/a.m3u8' },
        { content_type: 'video/mp4', bitrate: 832000, url: 'https://v/lo.mp4' },
        { content_type: 'video/mp4', bitrate: 2176000, url: 'https://v/hi.mp4' },
      ] } },
      { type: 'photo', media_url_https: 'https://pbs/x.jpg' },
    ],
  };
  const items = twitter.parseTweetResult(json);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://v/hi.mp4');
  assert.equal(items[1].url, 'https://pbs/x.jpg?name=orig');
  assert.deepEqual(items[0].meta, { site: 'x', author: 'alice', id: '111' });
  assert.deepEqual(twitter.parseTweetResult({ mediaDetails: [] }), []);
});

test('twitter: token matches the known syndication formula', () => {
  // token for id 1 => (1/1e15*pi).toString(36) with zeros and dot removed
  assert.equal(twitter.tweetToken('1'), ((1 / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, ''));
  assert.match(twitter.tweetToken('1850000000000000000'), /^[a-z0-9]+$/);
});

test('instagram: shortcode -> media id', () => {
  assert.equal(instagram.shortcodeToId('B'), '1');
  assert.equal(instagram.shortcodeToId('BA'), '64');
  assert.equal(instagram.shortcodeToId('CxQ7vBDJ0aX'), '3206838441338052183');
});

test('instagram: parses single video, image and carousel', () => {
  const user = { username: 'bob' };
  const video = instagram.parseMediaInfo({ items: [{ code: 'abc', user, video_versions: [
    { url: 'https://cdn/small.mp4', width: 360, height: 640 },
    { url: 'https://cdn/big.mp4', width: 720, height: 1280 },
  ] }] });
  assert.equal(video[0].url, 'https://cdn/big.mp4');
  assert.equal(video[0].type, 'video');

  const carousel = instagram.parseMediaInfo({ items: [{ code: 'abc', user, carousel_media: [
    { image_versions2: { candidates: [{ url: 'https://cdn/1s.jpg', width: 100, height: 100 }, { url: 'https://cdn/1b.jpg', width: 1080, height: 1080 }] } },
    { video_versions: [{ url: 'https://cdn/2.mp4', width: 720, height: 720 }] },
  ] }] });
  assert.deepEqual(carousel.map((i) => i.url), ['https://cdn/1b.jpg', 'https://cdn/2.mp4']);
  assert.deepEqual(instagram.parseMediaInfo({ items: [] }), []);
});

test('youtube: picks best direct mp4, reports unplayable / cipher-only', () => {
  const ok = youtube.parsePlayerResponse({
    playabilityStatus: { status: 'OK' },
    videoDetails: { author: 'Chan', videoId: 'dQw4w9WgXcQ' },
    streamingData: { formats: [
      { url: 'https://gv/360', mimeType: 'video/mp4; codecs="avc1"', width: 640, height: 360, bitrate: 500 },
      { url: 'https://gv/720', mimeType: 'video/mp4; codecs="avc1"', width: 1280, height: 720, bitrate: 1500 },
      { signatureCipher: 's=...', mimeType: 'video/mp4', width: 1920, height: 1080, bitrate: 3000 },
    ] },
  });
  assert.equal(ok.items[0].url, 'https://gv/720');
  assert.equal(ok.items[0].meta.author, 'Chan');

  assert.match(youtube.parsePlayerResponse({ playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in' } }).error, /Sign in/);
  assert.match(youtube.parsePlayerResponse({
    playabilityStatus: { status: 'OK' },
    streamingData: { formats: [{ signatureCipher: 'x', mimeType: 'video/mp4' }] },
  }).error, /No direct download/);
});
