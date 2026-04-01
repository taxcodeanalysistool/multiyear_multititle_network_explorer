// src/utils/parseSearchQuery.ts

export interface ParsedQuery {
  phrases: string[];   // exact quoted phrases e.g. "consumer price index"
  keywords: string[];  // individual unquoted keywords e.g. consumer, price
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const phrases: string[] = [];
  const keywords: string[] = [];

  // Extract quoted phrases first
  const quoteRegex = /"([^"]+)"/g;
  let match;
  while ((match = quoteRegex.exec(raw)) !== null) {
    const phrase = match[1].trim();
    if (phrase.length > 0) phrases.push(phrase);
  }

  // Remove quoted phrases from the string, then split remaining on commas
  const remainder = raw.replace(/"[^"]*"/g, '').trim();
  if (remainder.length > 0) {
    remainder.split(',').forEach((k) => {
      const t = k.trim();
      if (t.length > 0) keywords.push(t);
    });
  }

  return { phrases, keywords };
}