import { Browser } from "./tls_impersonate.js";
import { generateConsistentSample } from "./probability_sampling.js";
import { SupportedBrowser, SupportedBrowserOS } from "./types.js";

const browserDistribution = {
  nodes: [
    {
      name: "DeviceType",
      possibleValues: ["desktop", "mobile"],
      parentNames: [],
      conditionalProbabilities: {
        desktop: 0.9,
        mobile: 0.1, // we don't have fingerprints for mobile browsers except safari. that's why keeping it low for now
      },
    },
    {
      name: "OS",
      possibleValues: ["windows", "macos", "linux", "ios"],
      parentNames: ["DeviceType"],
      conditionalProbabilities: {
        deeper: {
          desktop: {
            windows: 0.7,
            macos: 0.2,
            linux: 0.1,
          },
          mobile: {
            ios: 0.3,
          },
        },
      },
    },
    {
      name: "Browser",
      possibleValues: ["chrome", "firefox", "safari"],
      parentNames: ["OS"],
      conditionalProbabilities: {
        deeper: {
          windows: {
            chrome: 0.8,
            firefox: 0.2,
          },
          macos: {
            safari: 0.5,
            chrome: 0.4,
            firefox: 0.1,
          },
          linux: {
            firefox: 0.7,
            chrome: 0.3,
          },
          ios: {
            safari: 1.0,
          },
        },
      },
    },
  ],
};

/**
 * selects a random browser based on probability distribution
 */
export function getRandomBrowser(
  browser?: SupportedBrowser,
  browserOS?: SupportedBrowserOS
): Browser {
  const browserName = browser;
  const os = browserOS;
  let config: Record<string, string[]> = {};
  if (browserName) config.Browser = [browserName];
  if (os) config.OS = [os];
  const result = generateConsistentSample(browserDistribution, config);
  return { name: result.Browser, os: result.OS } as Browser;
}
