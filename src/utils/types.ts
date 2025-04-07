export type SupportedBrowser = "chrome" | "firefox" | "safari";
export type SupportedBrowserOS = "windows" | "macos" | "ios" | "android";

export type ProxyZone = "residential_proxy";

export type ProxyOptions = {
  timeout?: number;
  sessionID?: string;

  // options for dedicated proxies
  name?: string;

  // options for managed proxies
  zone?: ProxyZone;

  city?: string;
};

type RequestMethod = "GET" | "get" | "POST" | "post" | "PUT" | "put" | "DELETE" | "delete";

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
}

type HeaderGenerator = () => {
  extraHeaders?: Record<string, string>;
  customHeaders?: Record<string, string>;
};

export interface CharlesTLSConfig {
  charlesPort?: string; // port for charles proxy
  tlsClientPort?: string; // port on which the tls client is running
}

type TLSImpersonateConfigBase<T extends RequestMethod = RequestMethod> = {
  httpVersion?: number;
  url: string;
  maxBodyLength?: number;
  method?: T;
  params?: { [key: string]: string | number };
  data?: T extends "POST" | "post" | "PUT" | "put" ? any : undefined;
  proxyOptions?: ProxyOptions;
  charles?: CharlesTLSConfig; // for debugging requests with charles proxy
  followRedirect?: boolean; // if true, will follow redirects , default is true
  headers?: never;
  cookies?: Cookie[];
  headerGenerator?: HeaderGenerator;
  extraHeaders?: Record<string, string>; // extra headers to be added along with default headers
  ignoreError?: boolean; // if true, will not throw an error if the request fails (e.g. 403) use this if you are expecting a "failure"/"error" response code
  customHeadersOrder?: string[];
};

export type TLSImpersonateConfig<T extends RequestMethod = RequestMethod> =
  | ({
      customHeaders?: undefined; // custom headers to be added to request. default headers are not added if this is provided
      // customHeadersOrder?: undefined; // custom headers order to be added to request. we added headers order based on browser and user agent in customHEaders.
      browser?: SupportedBrowser; // browser to use for headers order
      browserOS?: SupportedBrowserOS; // browser os to use for headers order
    } & TLSImpersonateConfigBase<T>)
  | ({
      customHeaders: Record<string, string>; // custom headers to be added to request. default headers are not added if this is provided
      // customHeadersOrder: string[]; // custom headers order to be added to request. we added headers order based on browser and user agent in customHEaders.
      browser: SupportedBrowser; // browser to use for headers order
      browserOS?: SupportedBrowserOS; // browser os to use for headers order
    } & TLSImpersonateConfigBase<T>)
  | ({
      customHeaders?: undefined; // No custom headers but manually set browser
      browser: SupportedBrowser; // browser to use for headers order and user agent
      browserOS?: SupportedBrowserOS; // browser os to use for headers order
    } & TLSImpersonateConfigBase<T>);

export interface TLSImpersonateResponse {
  statusCode: number;
  data: any;
  headers: Record<string, string>;
}
