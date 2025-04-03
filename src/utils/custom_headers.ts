import { Browser } from "./tls_impersonate.js";

/**
 * Returns latest browser headers based on the browser and operating system
 * current latest versions are:
 * - chrome: 131.0.0.0
 * - firefox: 133.0
 * - safari: 18.1.1
 */
export function getBrowserHeaders(browser: Browser): Record<string, string> {
  const headersByBrowser = {
    firefox: () => getFireFoxHeaders(browser.os as keyof typeof FIREFOX_HEADERS_BY_PLATFORM),
    safari: () => getSafariHeaders(browser.os as keyof typeof SAFARI_HEADERS_BY_PLATFORM),
    chrome: () => getChromeHeaders(browser.os as keyof typeof CHROME_HEADERS_BY_PLATFORM),
  };
  return headersByBrowser[browser.name]();
}

export function getChromeHeaders(
  platform: keyof typeof CHROME_HEADERS_BY_PLATFORM = "windows"
): Record<string, string> {
  return CHROME_HEADERS_BY_PLATFORM[platform] ?? CHROME_HEADERS_BY_PLATFORM["windows"]; // fallback to windows if platform is not supported
}

export function getFireFoxHeaders(
  platform: keyof typeof FIREFOX_HEADERS_BY_PLATFORM = "windows"
): Record<string, string> {
  return FIREFOX_HEADERS_BY_PLATFORM[platform] ?? FIREFOX_HEADERS_BY_PLATFORM["windows"]; // fallback to windows if platform is not supported
}

export function getSafariHeaders(
  platform: keyof typeof SAFARI_HEADERS_BY_PLATFORM = "ios"
): Record<string, string> {
  return SAFARI_HEADERS_BY_PLATFORM[platform] ?? SAFARI_HEADERS_BY_PLATFORM["ios"]; // fallback to ios if platform is not supported
}

// chrome headers
const CHROME_BASE_HEADERS = {
  "sec-ch-ua-mobile": "?0",
  "upgrade-insecure-requests": "1",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "sec-fetch-site": "same-site",
  "sec-fetch-mode": "navigate",
  "sec-fetch-user": "?1",
  "sec-fetch-dest": "document",
  "accept-encoding": "gzip, deflate, br, zstd",
  "accept-language": "en-US,en;q=0.9",
} as const;

const CHROME_VERSION = {
  version: "133",
  brandVersion: "24",
} as const;

const CHROME_HEADERS_BY_PLATFORM = {
  windows: {
    ...CHROME_BASE_HEADERS,
    "sec-ch-ua": `"Chromium";v="${CHROME_VERSION.version}", "Google Chrome";v="${CHROME_VERSION.version}", "Not_A Brand";v="${CHROME_VERSION.brandVersion}"`,
    "sec-ch-ua-platform": '"Windows"',
    "sec-ch-ua-mobile": "?0",
    "user-agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION.version}.0.0.0 Safari/537.36`,
  },
  macos: {
    ...CHROME_BASE_HEADERS,
    "sec-ch-ua": `"Google Chrome";v="${CHROME_VERSION.version}", "Chromium";v="${CHROME_VERSION.version}", "Not_A Brand";v="${CHROME_VERSION.brandVersion}"`,
    "sec-ch-ua-platform": '"macOS"',
    "sec-ch-ua-mobile": "?0",
    "user-agent": `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION.version}.0.0.0 Safari/537.36`,
  },
  android: {
    "Upgrade-Insecure-Requests": "1",
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    Accept: CHROME_BASE_HEADERS.accept,
    "Accept-Language": CHROME_BASE_HEADERS["accept-language"],
  },
  ios: {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "sec-fetch-site": "cross-site",
    "sec-fetch-mode": "navigate",
    "user-agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.154 Mobile/15E148 Safari/604.1",
    "accept-language": "en-GB,en;q=0.9",
    "sec-fetch-dest": "document",
  },
  linux: {
    ...CHROME_BASE_HEADERS,
    "sec-ch-ua": `"Chromium";v="${CHROME_VERSION.version}", "Google Chrome";v="${CHROME_VERSION.version}", "Not_A Brand";v="${CHROME_VERSION.brandVersion}"`,
    "sec-ch-ua-platform": '"Linux"',
    "sec-ch-ua-mobile": "?0",
    "user-agent": `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION.version}.0.0.0 Safari/537.36`,
  },
};

// firefox headers
const FIREFOX_BASE_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US",
  "accept-encoding": "gzip, deflate, br, zstd",
  "upgrade-insecure-requests": "1",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-site",
  "sec-fetch-user": "?1",
  te: "trailers",
  dnt: "1",
} as const;

const FIREFOX_VERSION = "133.0";

const FIREFOX_HEADERS_BY_PLATFORM = {
  windows: {
    ...FIREFOX_BASE_HEADERS,
    "user-agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${FIREFOX_VERSION}) Gecko/20100101 Firefox/${FIREFOX_VERSION}`,
  },
  macos: {
    ...FIREFOX_BASE_HEADERS,
    "user-agent": `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${FIREFOX_VERSION}) Gecko/20100101 Firefox/${FIREFOX_VERSION}`,
  },
  linux: {
    ...FIREFOX_BASE_HEADERS,
    "user-agent": `Mozilla/5.0 (X11; Linux x86_64; rv:${FIREFOX_VERSION}) Gecko/20100101 Firefox/${FIREFOX_VERSION}`,
  },
};

const SAFARI_HEADERS_BY_PLATFORM = {
  ios: {
    "sec-fetch-dest": "document",
    "user-agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1.1 Mobile/15E148 Safari/604.1",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "sec-fetch-site": "none",
    "sec-fetch-mode": "navigate",
    "sec-fetch-user": "?1",
    "accept-language": "en-GB,en;q=0.9",
    priority: "u=0, i",
  },
  macos: {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-GB,en;q=0.9",
    "accept-encoding": "gzip, deflate, br, zstd",
    "upgrade-insecure-requests": "1",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-site",
    "sec-fetch-user": "?1",
    priority: "u=0, i",
  },
};
