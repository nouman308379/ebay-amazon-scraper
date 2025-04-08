import axios, { AxiosRequestConfig } from "axios";
import { getProxyString } from "./proxy.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import { ProxyOptions } from "./types.js";

async function request(config: AxiosRequestConfig, options: ProxyOptions) {
  const proxyString = await getProxyString(options);
  const httpsAgent = new HttpsProxyAgent(proxyString);
  httpsAgent.options = { ...httpsAgent.options, rejectUnauthorized: false };
  let axiosClient = axios.create({ httpsAgent, timeout: 30_000 });

  const response = await axiosClient.request({
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "en-GB,en;q=0.9",
      "cache-control": "max-age=0",
      priority: "u=0, i",
      "sec-ch-ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      Cookie:
        'i18n-prefs=USD; session-id=136-9374119-0339858; session-id-time=2082787201l; sp-cdn="L5Z9:PK"; ubid-main=133-4752622-6964456',
    },
    ...config,
  });
  return response;
}

export { request };
