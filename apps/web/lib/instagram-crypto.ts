import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getInstagramTokenSecret() {
  const secret = process.env.INSTAGRAM_CONNECTION_TOKEN_SECRET?.trim();

  if (!secret) {
    throw new Error("INSTAGRAM_CONNECTION_TOKEN_SECRET is not configured.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptInstagramAccessToken(value: string) {
  const key = getInstagramTokenSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptInstagramAccessToken(ciphertext: string) {
  const [ivPart, tagPart, payloadPart] = ciphertext.split(".", 3);

  if (!ivPart || !tagPart || !payloadPart) {
    throw new Error("invalid_instagram_token_ciphertext");
  }

  const key = getInstagramTokenSecret();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadPart, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
