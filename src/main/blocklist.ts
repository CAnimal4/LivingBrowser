import { domainFromUrl } from "../shared/url.js";

export const defaultBlockedDomains = [
  "doubleclick.net",
  "googlesyndication.com",
  "google-analytics.com",
  "analytics.google.com",
  "googletagmanager.com",
  "facebook.net",
  "connect.facebook.net",
  "ads-twitter.com",
  "scorecardresearch.com",
  "taboola.com",
  "outbrain.com",
  "hotjar.com",
  "segment.io",
  "mixpanel.com",
  "adnxs.com",
  "criteo.com"
];

export class TrackerBlocker {
  private domains: Set<string>;

  constructor(domains = defaultBlockedDomains) {
    this.domains = new Set(domains.map((domain) => domain.toLowerCase()));
  }

  add(domain: string): void {
    this.domains.add(domain.toLowerCase());
  }

  has(domain: string): boolean {
    const clean = domain.replace(/^www\./, "").toLowerCase();
    if (this.domains.has(clean)) return true;
    return [...this.domains].some((blocked) => clean === blocked || clean.endsWith(`.${blocked}`));
  }

  shouldBlock(url: string): boolean {
    return this.has(domainFromUrl(url));
  }

  list(): string[] {
    return [...this.domains].sort();
  }
}
