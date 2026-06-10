export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "living://start";
  if (trimmed.startsWith("living://")) return trimmed;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed;
  if (trimmed.includes(" ") || !trimmed.includes(".")) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
  return `https://${trimmed}`;
}

export function domainFromUrl(input: string): string {
  try {
    if (input.startsWith("living://")) return "living";
    return new URL(input).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function originFromUrl(input: string): string {
  try {
    const url = new URL(input);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "unknown";
  }
}

export function isInternalUrl(input: string): boolean {
  return input.startsWith("living://");
}
