import { uuidv7 } from "uuidv7";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../lib/s3.js";
import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { imageQueue } from "../jobs/queues.js";
import * as mediaRepo from "../repositories/media.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadInput {
  uploaderId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
  altText?: string | null;
  folder?: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Uploads a file to S3 and creates a media record.
 * Image optimization is handled asynchronously via the image worker.
 *
 * Returns the media record immediately — the `url` points to the original.
 * Optimized variants are added to `metadata.sizes` once the worker completes.
 */
export async function uploadMedia(input: UploadInput) {
  const { uploaderId, filename, mimeType, sizeBytes, buffer, altText, folder } = input;

  // Validate before hitting S3
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw AppError.validation(
      `Unsupported file type: ${mimeType}. Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`
    );
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw AppError.validation(`File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`);
  }

  const ext = filename.split(".").pop() ?? "bin";
  const storageKey = `${folder ?? "uploads"}/${uuidv7()}.${ext}`;
  const url = `${env.S3_PUBLIC_URL}/${storageKey}`;

  // Upload original to S3 / MinIO
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    })
  );

  // Create DB record immediately — client gets back the URL right away
  const mediaRecord = await mediaRepo.createMedia({
    id: uuidv7(),
    uploaderId,
    filename: storageKey,
    originalFilename: filename,
    mimeType,
    sizeBytes,
    storageKey,
    url,
    altText: altText ?? null,
    folder: folder ?? null,
  });

  // Enqueue image optimization (SVG + GIF are skipped in the worker)
  if (mimeType !== "image/svg+xml" && mimeType !== "image/gif") {
    await imageQueue.add("optimize-image", {
      mediaId: mediaRecord.id,
      storageKey,
      mimeType,
    });
  }

  return mediaRecord;
}

export async function getMedia(id: string) {
  const m = await mediaRepo.findMediaById(id);
  if (!m) throw AppError.notFound("Media not found");
  return m;
}

export async function listUploaderMedia(uploaderId: string, page: number, pageSize: number) {
  return mediaRepo.findMediaByUploader(uploaderId, page, pageSize);
}

/**
 * Deletes a media record from DB.
 * Note: the S3 object is NOT deleted here to avoid accidental content loss
 * if the URL is embedded in post content. A separate S3 lifecycle policy
 * or orphan cleanup job should handle object deletion (Phase 5+).
 */
export async function deleteMedia(id: string, requesterId: string, requesterRole: string) {
  const m = await mediaRepo.findMediaById(id);
  if (!m) throw AppError.notFound("Media not found");

  if (m.uploaderId !== requesterId && requesterRole !== "admin") {
    throw AppError.forbidden("You can only delete your own media");
  }

  await mediaRepo.deleteMedia(id);
}
