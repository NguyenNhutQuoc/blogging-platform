import { Worker } from "bullmq";
import sharp from "sharp";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { redis } from "../../lib/redis.js";
import { s3 } from "../../lib/s3.js";
import { env } from "../../lib/env.js";
import { QUEUE_NAMES } from "@repo/shared/constants";
import * as mediaRepo from "../../repositories/media.js";

export interface ImageJobData {
  mediaId: string;
  storageKey: string;
  mimeType: string;
}

/**
 * Variant widths we generate for responsive images.
 * Width is the CSS breakpoint each variant targets.
 * The browser chooses the appropriate size via `srcset`.
 */
const VARIANT_WIDTHS = [400, 800, 1200] as const;

/**
 * Image optimization worker — runs after upload, independently of the API request.
 * Concurrency is 2 because sharp is CPU-intensive.
 *
 * Per job:
 * 1. Download the original from S3
 * 2. Get dimensions via sharp metadata
 * 3. Generate 3 WebP variants (400w, 800w, 1200w) — skip if original is smaller
 * 4. Upload variants back to S3 alongside the original
 * 5. Update the DB media record with dimensions + variant URLs in metadata
 */
export const imageWorker = new Worker<ImageJobData>(
  QUEUE_NAMES.IMAGE,
  async (job) => {
    const { mediaId, storageKey, mimeType } = job.data;
    console.log(`[ImageWorker] Optimizing media ${mediaId}`);

    // 1. Download original from S3
    const getResult = await s3.send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: storageKey })
    );

    const stream = getResult.Body;
    if (!stream) throw new Error("Empty response body from S3");

    // Collect the stream into a Buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const originalBuffer = Buffer.concat(chunks);

    // 2. Get dimensions from the original
    const meta = await sharp(originalBuffer).metadata();
    const originalWidth = meta.width ?? 0;
    const originalHeight = meta.height ?? 0;

    // 3. Generate WebP variants — only for widths smaller than the original
    const sizes: Record<string, string> = {};

    for (const width of VARIANT_WIDTHS) {
      if (width >= originalWidth) continue; // skip upscaling

      const variantBuffer = await sharp(originalBuffer)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      // 4. Upload variant: original key with -<width>w.webp suffix
      const variantKey = storageKey.replace(/\.[^.]+$/, `-${width}w.webp`);
      await s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET_NAME,
          Key: variantKey,
          Body: variantBuffer,
          ContentType: "image/webp",
          ContentLength: variantBuffer.length,
        })
      );

      sizes[`${width}w`] = `${env.S3_PUBLIC_URL}/${variantKey}`;
    }

    // 5. Update DB record with dimensions + variant URLs
    await mediaRepo.updateMedia(mediaId, {
      width: originalWidth,
      height: originalHeight,
      metadata: { sizes, optimizedAt: new Date().toISOString() },
    });

    console.log(
      `[ImageWorker] Done — ${mediaId}: ${originalWidth}x${originalHeight}, ${Object.keys(sizes).length} variants`
    );
  },
  { connection: redis, concurrency: 2 }
);

imageWorker.on("failed", (job, err) => {
  console.error(`[ImageWorker] Job ${job?.id} failed:`, err.message);
});
