import { TLSImpersonateConfig, TLSImpersonateResponse } from "./types.js";
import { readFileSync } from "fs";
import axios from "axios";
import { getProxyString } from "./proxy.js";
import { getRandomBrowser } from "./random_browser.js";
import { getBrowserHeaders } from "./custom_headers.js";
/**
 * TODO: mobile chrome has fair share of internet traffic, but currently client doesn't supports it's TLS settings.
 */

type SupportedBrowserNames = "safari" | "firefox" | "chrome";

export interface Browser {
  name: SupportedBrowserNames;
  os: "macos" | "ios" | "windows" | "linux";
}

/**
 * Ref: https://bogdanfinn.gitbook.io/open-source-oasis
 * makes browser like requests using go based tls impersonate lib. This lib is flexible as compare to curl cffi.
 * currently this method supports chrome, firefox, safari, safari_ios browsers and their latest TLS settings.
 * @param options.extraHeaders extends default headers
 * @param options.customHeaders if specified will only use these headers instead of default ones.
 * @param options.customHeadersOrder - only for rare cases in which our default headers order is not working. or testing purposes
 * @param options.browser to use browser specific TLS settings.
 * if no browser is specified then it uses bayesian network to get random browser based on internet traffic.
 * It adds default headers and order headers based on specified or randomly selected browser.
 * customHeaders is only useful when adding extra headers to default headers are not working. I am not able to think of any use cases for now but maybe useful in future.
 */
export async function tlsImpersonateRequest(
  config: TLSImpersonateConfig
): Promise<TLSImpersonateResponse> {
  if (config.customHeaders && !config.browser) {
    throw new Error("browser is required when customHeaders are provided");
  }

  const { extraHeaders, customHeaders } = config;

  const browser = getRandomBrowser(config.browser, config.browserOS);

  // headers order
  // if customHeadersOrder is provided, use it otherwise if customHeaders is provided, use the headers order from customHeaders else use the default headers order
  const headersOrder =
    config.customHeadersOrder ??
    (customHeaders ? getHeaderOrder(customHeaders) : getDefaultHeadersOrder(browser.name));

  const headers = resolveBrowserHeaders({
    browser,
    extraHeaders,
    customHeaders,
  });

  let proxy = await getProxyString(config.proxyOptions);
  const url = new URL(config.url);
  // set params to url
  Object.entries(config.params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, (value as any).toString());
  });

  let tlsClientUrl = config.charles
    ? `http://localhost:${config.charles?.tlsClientPort}/HttpReq`
    : "https://us-central1-durable-alpha.cloudfunctions.net/go-tls-client";

  const postData = {
    url: url.toString(),
    method: config.method ?? "GET",
    proxy: config.charles?.charlesPort ? undefined : proxy,
    cookies: config.cookies,
    browser: browser.name,
    headers,
    headersOrder,
    body: config.data,
    charles: {
      port: config.charles?.charlesPort,
    },
    followRedirect: config.followRedirect ?? true,
    forceHttp1: config.httpVersion === 1 || config.httpVersion === 1.1,
  };
  // assume content-type is application/json for post requests if not specified
  if (
    !(postData["headers"]?.["content-type"] || postData["headers"]?.["Content-Type"]) &&
    config.method?.toUpperCase() === "POST"
  ) {
    postData["headers"]["content-type"] = "application/json";
  }

  const { data } = await axios.request({
    method: "POST",
    url: tlsClientUrl,
    data: postData,
    validateStatus: () => true, // handle errors manually
  });

  if (data.statusCode === 200 || data.statusCode === 201) {
    return {
      data: parseData(data.body),
      headers: data.headers,
      statusCode: data.statusCode,
    };
  }
  if (config.ignoreError)
    return {
      data: data.body,
      headers: data.headers,
      statusCode: data.statusCode,
    };

  throw new Error(`Error fetching ${config.url}. Status code: ${data.statusCode}`);
}

/**
 * Create an array of the header order using the header object
 * @param headers
 */
function getHeaderOrder(headers: Record<string, string>) {
  return Object.keys(headers);
}

/**
 * parses data if it is json else returns the data as is.
 * @param data - data to parse
 * @returns parsed data or original data
 */
function parseData(data: string) {
  try {
    return JSON.parse(data);
  } catch (e) {
    return data;
  }
}

/**
 * consolidates headers for tls impersonate request.
 * @param browser - browser to use for headers
 * @param extraHeaders - extra headers to add to default headers
 * @param customHeaders - custom headers to use instead of default headers
 * @returns headers
 */
export function resolveBrowserHeaders({
  browser,
  extraHeaders,
  customHeaders,
}: {
  browser: Browser;
  extraHeaders?: Record<string, string>;
  customHeaders?: Record<string, string>;
}) {
  if (customHeaders && Object.keys(customHeaders).length > 0) return customHeaders;
  let headers = getBrowserHeaders(browser);
  if (extraHeaders) headers = { ...headers, ...extraHeaders };
  return headers;
}

// Lazy loaded singleton for headers order data
let headersOrderData: Record<SupportedBrowserNames, string[]>;

/**
 * returns default headers order that browsers uses to make make requests.
 * Some antibots like cloudflare uses headers order to detect bots.
 */
function getDefaultHeadersOrder(browser: SupportedBrowserNames) {
  if (!headersOrderData) {
    headersOrderData = JSON.parse(readFileSync("data/browser-headers-order.json", "utf-8"));
  }
  return headersOrderData![browser];
}
