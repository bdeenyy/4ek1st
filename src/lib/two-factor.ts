import crypto from "crypto";
import { encrypt, decrypt, isEncrypted } from "./encryption";

/**
 * Generate a random secret for TOTP
 * Base32 encoded, 20 bytes = 32 characters
 */
function generateBase32Secret(length: number = 20): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const randomBytes = crypto.randomBytes(length);
  let secret = "";
  for (let i = 0; i < length; i++) {
    secret += chars[randomBytes[i] % 32];
  }
  return secret;
}

/**
 * Generate a new TOTP secret for a user
 * @param email - User email for the authenticator label
 * @returns Object containing secret and otpauth URL
 */
export function generateTwoFactorSecret(email: string): {
  secret: string;
  otpauthUrl: string;
  qrCodeUrl: string;
} {
  // Generate a new secret
  const secret = generateBase32Secret();
  
  // Create otpauth URL for QR code
  const serviceName = encodeURIComponent("Staffy");
  const label = encodeURIComponent(email);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${serviceName}&algorithm=SHA1&digits=6&period=30`;
  
  return {
    secret,
    otpauthUrl,
    // QR code URL using Google Charts API
    qrCodeUrl: `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(otpauthUrl)}&choe=UTF-8`,
  };
}

/**
 * Verify a TOTP code against a secret
 * @param token - The 6-digit code from authenticator app
 * @param secret - The user's TOTP secret
 * @returns True if the code is valid
 */
export function verifyTwoFactorToken(token: string, secret: string): boolean {
  try {
    // Generate expected token
    const expectedToken = generateTOTP(secret);
    
    // Compare with constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(token.padStart(6, "0")),
      Buffer.from(expectedToken.padStart(6, "0"))
    );
  } catch (error) {
    console.error("Error verifying 2FA token:", error);
    return false;
  }
}

/**
 * Generate TOTP code from secret
 * @param secret - Base32 encoded secret
 * @returns 6-digit TOTP code
 */
function generateTOTP(secret: string): string {
  // Decode base32 secret
  const decodedSecret = base32Decode(secret);
  
  // Get current time step (30 second window)
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigUInt64BE(BigInt(timeStep), 0);
  
  // HMAC-SHA1
  const hmac = crypto.createHmac("sha1", decodedSecret);
  hmac.update(timeBuffer);
  const hmacResult = hmac.digest();
  
  // Dynamic truncation
  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const code = (
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, "0");
}

/**
 * Decode base32 string to buffer
 */
function base32Decode(str: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  str = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  
  const result: number[] = [];
  let bits = 0;
  let value = 0;
  
  for (const char of str) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    
    value = (value << 5) | index;
    bits += 5;
    
    if (bits >= 8) {
      bits -= 8;
      result.push((value >> bits) & 0xff);
    }
  }
  
  return Buffer.from(result);
}

/**
 * Encrypt a TOTP secret for storage
 * @param secret - Plain text secret
 * @returns Encrypted secret
 */
export function encryptSecret(secret: string): string {
  return encrypt(secret);
}

/**
 * Decrypt a TOTP secret for verification
 * @param encryptedSecret - Encrypted secret from database
 * @returns Plain text secret
 */
export function decryptSecret(encryptedSecret: string): string {
  if (!isEncrypted(encryptedSecret)) {
    // Not encrypted, return as-is (for backward compatibility)
    return encryptedSecret;
  }
  return decrypt(encryptedSecret);
}

/**
 * Generate backup codes for account recovery
 * @param count - Number of backup codes to generate (default 10)
 * @returns Array of backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = Array.from({ length: 8 }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
    ).join("");
    codes.push(code);
  }
  
  return codes;
}

/**
 * Hash a backup code for storage
 * @param code - Plain text backup code
 * @returns Hashed code
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(code.toUpperCase()).digest("hex");
}

/**
 * Verify a backup code
 * @param code - The code provided by user
 * @param hashedCodes - Array of hashed backup codes from database
 * @returns True if the code matches any stored hash
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): boolean {
  const hashedInput = hashBackupCode(code);
  return hashedCodes.includes(hashedInput);
}