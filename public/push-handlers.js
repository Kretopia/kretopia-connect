// Push and notification-click handlers for the Kretopia service worker.
//
// This file is loaded by the generated Workbox worker (vite.config.ts, workbox.importScripts). It must NOT be called sw.js:
// the build writes the Workbox worker to /sw.js and overwrote the file of that name, so these handlers never reached
// production and no notification could ever be shown.
//
// No install, activate or fetch handlers here: they would fight Workbox (skipWaiting and clientsClaim are set in the build).

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

var ICON = '/pwa-192x192.png';
// Android draws a badge as a mask: only its alpha channel counts, so it is a white K on transparency, not the colour icon.
var BADGE = '/pwa-badge-96.png';

// The payload is whatever send-push-notification encrypted for this device: { title, body, url, tag, type }.
function readPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json() || {};
  } catch (error) {
    try {
      return { body: event.data.text() };
    } catch (ignored) {
      return {};
    }
  }
}

// A notification may only lead into this app. The server already sends relative paths; this is the second check, on the
// device, so a payload can never make a tap open another site.
function appUrl(value) {
  try {
    var url = new URL(value || '/', self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search + url.hash : '/';
  } catch (error) {
    return '/';
  }
}

self.addEventListener('push', function (event) {
  // A push must always show something (the browser requires it of a userVisibleOnly subscription), even when the payload is
  // empty or unreadable.
  var data = readPayload(event);
  var tag = typeof data.tag === 'string' && data.tag ? data.tag : undefined;
  var options = {
    body: data.body || 'You have a new notification',
    icon: ICON,
    badge: BADGE,
    vibrate: [100, 50, 100],
    data: { url: appUrl(data.url), type: data.type || null },
  };
  if (tag) {
    // One notification per tag: a repeated request replaces the first instead of stacking, and still alerts.
    options.tag = tag;
    options.renotify = true;
  }

  event.waitUntil(self.registration.showNotification(data.title || 'Kretopia', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = appUrl(event.notification.data && event.notification.data.url);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      // Reuse a window of the app that is already open (the installed app, or a tab): it gets the page, and a second copy of
      // the app does not pile up behind it.
      for (var i = 0; i < windows.length; i++) {
        var client = windows[i];
        var sameApp = false;
        try {
          sameApp = new URL(client.url).origin === self.location.origin;
        } catch (error) {
          sameApp = false;
        }
        if (sameApp && typeof client.focus === 'function') {
          return client.focus().then(function (focused) {
            var focusedWindow = focused || client;
            if (typeof focusedWindow.navigate === 'function') {
              return focusedWindow.navigate(target).catch(function () {
                return self.clients.openWindow(target);
              });
            }
            return self.clients.openWindow(target);
          });
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// The push service can replace a subscription (an expired or rotated one). Subscribe again with the same server key so the
// device stays reachable, and tell any open window: it re-registers the new endpoint with the member's account, because this
// worker has no session to do it with.
self.addEventListener('pushsubscriptionchange', function (event) {
  var options = event.oldSubscription && event.oldSubscription.options;
  var resubscribe =
    options && options.applicationServerKey
      ? self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: options.applicationServerKey })
      : Promise.resolve(null);

  event.waitUntil(
    resubscribe
      .catch(function () {
        return null;
      })
      .then(function () {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then(function (windows) {
        windows.forEach(function (client) {
          client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
        });
      })
  );
});
