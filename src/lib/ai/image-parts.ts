import { createTemporaryReadUrl } from "@/src/lib/storage/r2";

export type ImagePart = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
};

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function mimeTypeFromKey(key: string): ImagePart["mimeType"] {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export async function loadImageParts(
  images: Array<{ key: string }>,
  options: { maxImages?: number; maxImageBytes?: number } = {},
) {
  const maxImages = options.maxImages ?? 6;
  const maxImageBytes = options.maxImageBytes ?? MAX_IMAGE_BYTES;
  const loaded: ImagePart[] = [];

  for (const image of images.slice(0, maxImages)) {
    const signed = await createTemporaryReadUrl(image.key);
    const response = await fetch(signed.url);
    if (!response.ok) continue;
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > maxImageBytes) continue;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxImageBytes) continue;
    loaded.push({ mimeType: mimeTypeFromKey(image.key), data: arrayBufferToBase64(buffer) });
  }

  if (loaded.length === 0) throw new Error("Aucune image exploitable pour l'analyse");
  return loaded;
}
