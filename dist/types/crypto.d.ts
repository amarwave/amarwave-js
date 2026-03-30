/**
 * Compute HMAC-SHA256 and return as lowercase hex string.
 * Uses the WebCrypto API (available in all modern browsers and Node 18+).
 */
export declare function hmacSHA256(secret: string, message: string): Promise<string>;
/** Generate a short random ID string. */
export declare function uid(): string;
