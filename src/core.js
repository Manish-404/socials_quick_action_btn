// Shared namespace for content scripts. All content scripts run in one isolated
// world, so adapters register themselves here and content.js picks one.
(function (root) {
  const S = (root.SQAB = root.SQAB || {});
  S.adapters = [];
  S.registerAdapter = (adapter) => S.adapters.push(adapter);
  // Thrown by adapters when a post has nothing we can download; message is shown to the user.
  S.Unsupported = class Unsupported extends Error {};
})(globalThis);
