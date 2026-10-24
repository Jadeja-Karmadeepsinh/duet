import crypto from 'node:crypto';

/**
 * Normalizes display names with Unicode NFKC normalization, whitespace trimming,
 * and case-folding to guarantee uniqueness and avoid duplicate profiles.
 */
export function normalizeDisplayName(name: string): string {
  if (!name) return '';
  return name.trim().normalize('NFKC').toLowerCase();
}

/**
 * Hashes a PIN using Node.js built-in scrypt with a cryptographic salt.
 * Produces format: scrypt$hexSalt$hexDerivedKey
 */
export async function hashPin(pin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(pin, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verifies a candidate PIN against a stored scrypt hash using timing-safe comparison.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parts = storedHash.split('$');
      if (parts.length !== 3 || parts[0] !== 'scrypt') {
        return resolve(false);
      }
      const salt = parts[1];
      const keyBuffer = Buffer.from(parts[2], 'hex');

      crypto.scrypt(pin, salt, keyBuffer.length, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
        if (err) return resolve(false);
        if (derivedKey.length !== keyBuffer.length) return resolve(false);
        resolve(crypto.timingSafeEqual(derivedKey, keyBuffer));
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Generates an opaque random 32-byte session token for cookies
 * and calculates its SHA-256 hash for database storage.
 */
export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Hashes an opaque raw session token using SHA-256.
 */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
