/**
 * Profanity / slur filter for global chat.
 * Catches leet-speak, symbol substitutions, repeated characters.
 * Ported from MontraFi's proven filter.
 */

const SUBS: Record<string, string> = {
  "@": "a", "4": "a", "^": "a",
  "8": "b",
  "(": "c", "{": "c",
  "3": "e",
  "6": "g", "9": "g",
  "#": "h",
  "!": "i", "1": "i", "|": "i",
  "0": "o",
  "5": "s", "$": "s",
  "7": "t", "+": "t",
  "2": "z",
};

function normalize(text: string): string {
  let s = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.toLowerCase();
  s = s.split("").map((c) => SUBS[c] || c).join("");
  s = s.replace(/[^a-z\s]/g, "");
  s = s.replace(/(.)\1{2,}/g, "$1$1");
  return s;
}

const BANNED_PATTERNS: string[] = [
  "anal", "anus", "bastard", "bitch", "blowjob", "boner", "butthole",
  "chink", "clit", "cock", "coon", "cum", "cunt", "damn", "dick",
  "dildo", "dyke", "fag", "fagg", "faggot", "felch", "fuck", "gook",
  "handjob", "homo", "jizz", "kike", "lesbo", "milf", "negro",
  "nigga", "nigger", "pedo", "penis", "piss", "porn", "pussy", "rape",
  "retard", "scrotum", "semen", "shit", "slut", "smegma", "spic",
  "testicle", "tits", "tranny", "twat", "vagina", "vulva", "wank",
  "wetback", "whore",
];

const BANNED_RE = BANNED_PATTERNS.map(
  (word) => new RegExp(`(?:^|\\s|\\b)${word}(?:\\s|$|\\b)`, "i"),
);

const STRICT_SUBSTRINGS = [
  "nigger", "nigga", "faggot", "fagg", "fag", "kike", "chink",
  "gook", "spic", "wetback", "tranny", "retard", "cunt",
];

export function checkProfanity(text: string): { clean: boolean; reason?: string } {
  const normalized = normalize(text);

  for (const slur of STRICT_SUBSTRINGS) {
    if (normalized.includes(slur)) {
      return { clean: false, reason: "Message contains prohibited language" };
    }
  }

  for (const re of BANNED_RE) {
    if (re.test(normalized)) {
      return { clean: false, reason: "Message contains inappropriate language" };
    }
  }

  return { clean: true };
}
