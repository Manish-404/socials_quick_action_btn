const test = require('node:test');
const assert = require('node:assert/strict');
const { pickBestVideo, pickLargestImage, parseSrcset } = require('../../src/lib/pick.js');
const { buildFilename, sanitize } = require('../../src/lib/filename.js');
const { isAudioOnly, normalizeMediaUrl, pickSniffed } = require('../../src/lib/sniff.js');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

test('pickBestVideo picks highest bitrate mp4 and ignores HLS', () => {
  const v = [
    { url: 'a.m3u8', content_type: 'application/x-mpegURL' },
    { url: 'lo.mp4', content_type: 'video/mp4', bitrate: 800 },
    { url: 'hi.mp4', content_type: 'video/mp4', bitrate: 2000 },
  ];
  assert.equal(pickBestVideo(v).url, 'hi.mp4');
  assert.equal(pickBestVideo(v, 'smallest').url, 'lo.mp4');
  assert.equal(pickBestVideo([{ url: 'x.m3u8', content_type: 'application/x-mpegURL' }]), null);
});

test('pickLargestImage / parseSrcset', () => {
  assert.equal(pickLargestImage([{ url: 'a', width: 10, height: 10 }, { url: 'b', width: 20, height: 20 }]).url, 'b');
  assert.equal(pickLargestImage([]), null);
  assert.deepEqual(parseSrcset('a.jpg 320w, b.jpg 640w'), [
    { url: 'a.jpg', width: 320 },
    { url: 'b.jpg', width: 640 },
  ]);
});

test('buildFilename sanitizes, numbers multi-media posts and picks ext', () => {
  const item = { url: 'https://x/y/clip.mp4?sig=1', type: 'video', meta: { site: 'x', author: 'a/b:c', id: '42' } };
  assert.equal(buildFilename('{site}_{author}_{id}', item, 0, 1), 'x_a_b_c_42.mp4');
  assert.equal(buildFilename('{site}_{id}', item, 1, 3), 'x_42_2.mp4');
  assert.equal(buildFilename('{author}', { url: 'https://x/p', type: 'image', meta: {} }, 0, 1), 'download.jpg');
  assert.equal(buildFilename('{date}', item, 0, 1, new Date('2026-01-02T00:00:00Z')), '2026-01-02.mp4');
  assert.equal(sanitize('../../etc/passwd'), 'etc_passwd');
});

test('sniff helpers', () => {
  const audio = 'https://v.fbcdn.net/a.mp4?efg=' + b64({ vencode_tag: 'dash_ln_heaac_vbr3_audio' });
  const video = 'https://v.fbcdn.net/v.mp4?efg=' + b64({ vencode_tag: 'dash_h264-basic-gen2_720p' });
  assert.equal(isAudioOnly(audio), true);
  assert.equal(isAudioOnly(video), false);
  assert.equal(normalizeMediaUrl('https://v/x.mp4?a=1&bytestart=0&byteend=99'), 'https://v/x.mp4?a=1');
  assert.equal(pickSniffed([{ url: video }, { url: audio }]).url, video);
  assert.equal(pickSniffed([]), null);
});
