import crypto from "crypto";

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// Get encryption key from environment or generate a default (for development)
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    console.warn("WARNING: ENCRYPTION_KEY not set, using development key. DO NOT USE IN PRODUCTION!");
    // Default key for development only - 32 bytes for AES-256
    return crypto.scryptSync("development-key", "salt", 32);
  }
  
  // Ensure key is 32 bytes for AES-256
  return Buffer.from(key.padEnd(32).slice(0, 32));
}

/**
 * Encrypt a string value
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: salt:iv:authTag:encrypted
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Derive key from master key and salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, "sha512");
  
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Format: salt:iv:authTag:encrypted
  return [
    salt.toString("hex"),
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted,
  ].join(":");
}

/**
 * Decrypt an encrypted string
 * @param encryptedData - Encrypted string in format: salt:iv:authTag:encrypted
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  
  const [saltHex, ivHex, authTagHex, encrypted] = encryptedData.split(":");
  
  if (!saltHex || !ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted data format");
  }
  
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  
  // Derive key from master key and salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, "sha512");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Hash a value (one-way, for passwords or sensitive identifiers)
 * @param value - Value to hash
 * @returns Hashed value
 */
export function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Generate a secure random token
 * @param length - Length of the token in bytes (default 32)
 * @returns Random token in hex format
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Mask a phone number for display
 * @param phone - Phone number to mask
 * @returns Masked phone number (e.g., +7 (999) ***-**-67)
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return phone;
  
  // Keep last 2 digits visible
  const lastTwo = phone.slice(-2);
  const firstPart = phone.slice(0, -2).replace(/\d/g, "*");
  
  return firstPart + lastTwo;
}

/**
 * Check if a value is encrypted
 * @param value - Value to check
 * @returns True if the value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  // Check if value matches our encryption format: salt:iv:authTag:encrypted
  const parts = value.split(":");
  return parts.length === 4 && parts.every(part => /^[0-9a-f]+$/i.test(part));
}

/**
 * Encrypt phone number if not already encrypted
 * @param phone - Phone number to encrypt
 * @returns Encrypted phone number
 */
export function encryptPhone(phone: string): string {
  if (isEncrypted(phone)) {
    return phone; // Already encrypted
  }
  return encrypt(phone);
}

/**
 * Decrypt phone number for display (with optional masking)
 * @param encryptedPhone - Encrypted phone number
 * @param mask - Whether to mask the result (default false)
 * @returns Decrypted (and optionally masked) phone number
 */
export function decryptPhone(encryptedPhone: string, mask: boolean = false): string {
  try {
    if (!isEncrypted(encryptedPhone)) {
      return mask ? maskPhone(encryptedPhone) : encryptedPhone;
    }
    
    const decrypted = decrypt(encryptedPhone);
    return mask ? maskPhone(decrypted) : decrypted;
  } catch (error) {
    console.error("Failed to decrypt phone:", error);
    return "***";
  }
}