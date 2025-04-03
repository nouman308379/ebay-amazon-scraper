import { ProxyOptions } from "./types.js";

/**
 * Proxy connection string for use in gcf invocations
 * @param options
 *
 * @returns
 */
export async function getProxyString(options?: ProxyOptions) {
  const { username, password, host, port, http } = await getProxyInfo(options);
  return `${http ? "http" : "https"}://${username}:${password}@${host}:${port}`;
}

export async function getProxyInfo(options?: ProxyOptions) {
  let username, password, host, port;
  let http = true;

  username = await buildBrightUsername(options);
  password = process.env.PROXY_SERVER_PASSWORD;
  host = process.env.PROXY_SERVER_HOST;
  port = process.env.PROXY_SERVER_PORT;
  if (!username || !password || !host || !port) {
    throw new Error(
      "PROXY_SERVER_USERNAME, PROXY_SERVER_PASSWORD, PROXY_SERVER_HOST, PROXY_SERVER_PORT are not set"
    );
  }

  return {
    username,
    password,
    host,
    port,
    http,
  };
}

export async function buildBrightUsername(options?: ProxyOptions) {
  let username = process.env.PROXY_SERVER_USERNAME;
  username = username + `-zone-${options?.zone ?? "data_center"}` + "US";

  /**
   * The dedicated cities incurs additional cost (~3x what we pay residential) and also isn't exactly in the city
   * i.e. for "boston" a ipinfo check showed the ip was in worcester, a suburb 10 miles out.
   */
  if (options?.city) {
    // if city is provided ensure it has no spaces and non alphabet characters (maybe in the future we need to support others)
    if (!/^[a-zA-z]+$/.test(options.city)) {
      throw new Error(
        `City must be a single word with only alphabet characters. i.e New York -> newyork. Got ${options.city}`
      );
    }
    username += `-city-${options.city}`;
  }

  if (options?.sessionID) {
    username += `-session-${options.sessionID}`;
  }

  //  if (options?.zipCode) {
  //    throw new SystemError(`Zip code is not supported for bright proxy`);
  //  }

  return username;
}
