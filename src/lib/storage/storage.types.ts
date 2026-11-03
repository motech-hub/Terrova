export const MAX_PHOTOS = 10;
export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
export const TEMP_RETENTION_HOURS = 24;
export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export type PresignedUploadInput = {
  sessionId: string;
  fileName: string;
  contentType: SupportedImageType;
  size: number;
};

export type PresignedUpload = {
  key: string;
  uploadUrl: string;
  expiresIn: number;
  demo?: boolean;
};

export type TemporaryReadUrl = {
  key: string;
  url: string;
  expiresIn: number;
};
