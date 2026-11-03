import { getEnv, hasR2Config } from "@/src/lib/env";
import {
  MAX_IMAGE_SIZE_BYTES,
  type PresignedUpload,
  type PresignedUploadInput,
  type TemporaryReadUrl,
} from "@/src/lib/storage/storage.types";

const UPLOAD_EXPIRES_SECONDS = 60 * 10;
const READ_EXPIRES_SECONDS = 60 * 30;
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;

function getR2Endpoint() {
  const env = getEnv();
  return new URL(
    env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  );
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeObjectPath(key: string) {
  return key.split("/").map(encodePathSegment).join("/");
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function textBytes(value: string) {
  const bytes = new TextEncoder().encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function hmacSha256(key: ArrayBuffer, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
}

function bytesToHex(value: ArrayBuffer) {
  return [...new Uint8Array(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getAmzDates(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    date: iso.slice(0, 8),
    dateTime: iso,
  };
}

async function createR2SignedUrl({
  expiresIn,
  key,
  method,
}: {
  expiresIn: number;
  key: string;
  method: "DELETE" | "GET" | "PUT";
}) {
  const env = getEnv();
  const endpoint = getR2Endpoint();
  const host = endpoint.host;
  const bucket = env.R2_BUCKET_NAME ?? "";
  const { date, dateTime } = getAmzDates();
  const region = "auto";
  const service = "s3";
  const scope = `${date}/${region}/${service}/aws4_request`;
  const credential = `${env.R2_ACCESS_KEY_ID}/${scope}`;
  const canonicalUri = `/${encodePathSegment(bucket)}/${encodeObjectPath(key)}`;
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": dateTime,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  });
  query.sort();

  const canonicalRequest = [
    method,
    canonicalUri,
    query.toString(),
    `host:${host}`,
    "",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateTime,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const dateKey = await hmacSha256(textBytes(`AWS4${env.R2_SECRET_ACCESS_KEY}`), date);
  const regionKey = await hmacSha256(dateKey, region);
  const serviceKey = await hmacSha256(regionKey, service);
  const signingKey = await hmacSha256(serviceKey, "aws4_request");
  const signature = bytesToHex(await hmacSha256(signingKey, stringToSign));
  query.set("X-Amz-Signature", signature);

  return `${endpoint.origin}${canonicalUri}?${query.toString()}`;
}

export function createObjectKey(input: PresignedUploadInput) {
  const extension = input.contentType === "image/png" ? "png" : input.contentType === "image/webp" ? "webp" : "jpg";
  const cleanSessionId = input.sessionId.replace(/[^a-zA-Z0-9-]/g, "");
  return `temp/${cleanSessionId}/input/${crypto.randomUUID()}.${extension}`;
}

export function createVideoObjectKey(sessionId: string) {
  const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, "");
  if (!cleanSessionId) throw new Error("Session invalide");
  return `temp/${cleanSessionId}/output/${crypto.randomUUID()}.mp4`;
}

export function assertSafeTempKey(key: string) {
  if (!/^temp\/[a-zA-Z0-9-]+\/(input|output)\/[a-f0-9-]+\.(jpg|png|webp|mp4)$/.test(key)) {
    throw new Error("Unsafe object key");
  }
}

export function assertSessionOwnsTempKey(sessionId: string, key: string) {
  assertSafeTempKey(key);
  const expectedPrefix = `temp/${sessionId}/input/`;
  if (!key.startsWith(expectedPrefix)) {
    throw new Error("La clé d'image n'appartient pas à la session");
  }
}

export function assertAnySessionOwnsTempKey(sessionIds: string[], key: string) {
  let lastError: unknown;
  for (const sessionId of sessionIds) {
    try {
      assertSessionOwnsTempKey(sessionId, key);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("La clé d'image n'appartient à aucune session autorisée");
}

export async function createPresignedUpload(input: PresignedUploadInput): Promise<PresignedUpload> {
  if (input.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("File too large");
  }

  const key = createObjectKey(input);
  if (!hasR2Config()) {
    return {
      key,
      uploadUrl: `/api/uploads/demo/${encodeURIComponent(key)}`,
      expiresIn: UPLOAD_EXPIRES_SECONDS,
      demo: true,
    };
  }

  return {
    key,
    uploadUrl: await createR2SignedUrl({
      expiresIn: UPLOAD_EXPIRES_SECONDS,
      key,
      method: "PUT",
    }),
    expiresIn: UPLOAD_EXPIRES_SECONDS,
  };
}

export async function createTemporaryReadUrl(key: string): Promise<TemporaryReadUrl> {
  assertSafeTempKey(key);
  if (!hasR2Config()) {
    return {
      key,
      url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      expiresIn: READ_EXPIRES_SECONDS,
    };
  }

  return {
    key,
    url: await createR2SignedUrl({
      expiresIn: READ_EXPIRES_SECONDS,
      key,
      method: "GET",
    }),
    expiresIn: READ_EXPIRES_SECONDS,
  };
}

export async function uploadTemporaryVideoFromUrl(
  sessionId: string,
  videoUrl: string,
  headers?: Record<string, string>,
) {
  const key = createVideoObjectKey(sessionId);
  if (!hasR2Config()) return { key: undefined, demo: true };

  const response = await fetch(videoUrl, headers ? { headers } : undefined);
  if (!response.ok) {
    throw new Error(`Le téléchargement de la vidéo a échoué (${response.status})`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_VIDEO_SIZE_BYTES) {
    throw new Error("La vidéo générée dépasse la taille maximale autorisée");
  }

  const uploadUrl = await createR2SignedUrl({
    expiresIn: UPLOAD_EXPIRES_SECONDS,
    key,
    method: "PUT",
  });
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4" },
    body: response.body,
  });

  if (!uploadResponse.ok) {
    throw new Error(`L'enregistrement R2 a échoué (${uploadResponse.status})`);
  }

  return { key };
}

export async function deleteTemporaryObject(key: string) {
  assertSafeTempKey(key);
  if (!hasR2Config()) return { deleted: true, demo: true };

  const url = await createR2SignedUrl({ expiresIn: 60, key, method: "DELETE" });
  await fetch(url, { method: "DELETE" });
  return { deleted: true };
}
