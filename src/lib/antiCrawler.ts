import { antiCrawlerPayload } from "./antiCrawlerPayload";

const ANTI_CRAWLER_PASSWORD = "entid114514";

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function deriveAesKey(password: string, salt: Uint8Array) {
  const encodedPassword = new TextEncoder().encode(password);
  const material = await crypto.subtle.importKey("raw", encodedPassword, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: bytesToArrayBuffer(salt),
      iterations: antiCrawlerPayload.iterations,
      hash: antiCrawlerPayload.hash
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function decryptAntiCrawlerScript() {
  const salt = base64ToBytes(antiCrawlerPayload.salt);
  const iv = base64ToBytes(antiCrawlerPayload.iv);
  const data = base64ToBytes(antiCrawlerPayload.data);
  const tag = base64ToBytes(antiCrawlerPayload.tag);
  const cipherText = new Uint8Array(data.length + tag.length);
  cipherText.set(data);
  cipherText.set(tag, data.length);
  const key = await deriveAesKey(ANTI_CRAWLER_PASSWORD, salt);
  const plainText = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytesToArrayBuffer(iv) }, key, bytesToArrayBuffer(cipherText));
  return new TextDecoder().decode(plainText);
}

void decryptAntiCrawlerScript()
  .then((script) => {
    new Function(script)();
  })
  .catch((error) => {
    console.warn("Failed to load anti-crawler layer:", error);
  });
