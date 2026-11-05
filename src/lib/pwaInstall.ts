/**
 * Samsung Internet packages an installed web app with its own tooling, and Google Play Protect blocks that package on Android ("Unsafe app
 * blocked: this app was built for an older version of Android and doesn't include the latest privacy protections"). Chrome's packager is
 * not affected. So Kretopia is never offered for installation from Samsung Internet: people are sent to Chrome, and index.html drops the web
 * manifest there so the browser's own "Install app" does not appear either (without a manifest it can only make a plain shortcut).
 */
export function isSamsungInternet(userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /SamsungBrowser/i.test(userAgent);
}

const CHROME_ON_PLAY_STORE = "https://play.google.com/store/apps/details?id=com.android.chrome";

/** An Android intent link that opens `href` in Chrome, or Chrome's Play Store page when Chrome is not installed. */
export function openInChromeHref(href: string): string {
  const url = new URL(href);
  const scheme = url.protocol.replace(":", "");
  // The fragment is left out: in an intent link everything after "#Intent" is the intent's own data.
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(CHROME_ON_PLAY_STORE)};end`;
}
