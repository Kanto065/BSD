import bcrypt from "bcrypt";
import { randomInt } from "node:crypto";

// Admin passwords: bcrypt hashes only, never stored or logged in plain text.

const COST = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, COST);

// A fixed hash to compare against when the email is unknown, so a login attempt takes the same time either way and
// timing does not reveal which emails have accounts.
const DUMMY_HASH = "$2b$12$DAcMUeOHGhCxjqQqhLfyZu18v74LCx1qkNgVrTLnemSIJP72SJSJO"; // hash of a random throwaway string

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return Boolean(hash) && ok;
}

// Words that make a password easy to guess for this site in particular.
const GUESSABLE = ["password", "passw0rd", "bangladesh", "swansea", "wales", "bsd", "admin", "bayconnect", "qwerty", "letmein", "welcome", "directory"];

export const PASSWORD_RULES = "Use at least 12 characters. Avoid names of the site, the region or common words, and do not reuse your email.";

/** Returns a message explaining what is wrong, or null when the password is acceptable. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "Use at most 200 characters.";
  const lower = password.toLowerCase();
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 3 && lower.includes(local)) return "Do not include your email name in the password.";
  const hit = GUESSABLE.find((w) => lower.includes(w));
  if (hit) return `Avoid easy-to-guess words such as "${hit}".`;
  if (new Set(password).size < 6) return "Use a wider mix of characters.";
  if (/^(.)\1+$/.test(password) || /0123|1234|2345|3456|4567|5678|6789|abcd|qwer/i.test(password)) {
    return "Avoid sequences like 1234 or abcd.";
  }
  return null;
}

/** A readable one-time password for new or reset accounts. The person must change it at first login. */
export function temporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () => alphabet[randomInt(alphabet.length)];
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, pick).join("")).join("-");
}
