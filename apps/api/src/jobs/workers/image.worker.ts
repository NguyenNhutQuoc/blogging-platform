import { Worker } from "bullmq";
import { redis } from "../../lib/redis.js";
import { QUEUE_NAMES } from "@repo/shared/constants";

export interface ImageJobData {
  mediaId: string;
  storageKey: string;
  mimeType: string;
}

/**
 * Image optimization worker — processes uploaded images after they land in S3.
 * Concurrency is 2 because sharp is CPU-intensive; don't starve the API process.
 *
 * Tasks per job:
 * 1. Download from S3
 * 2. Resize to standard widths (320, 640, 1280, 1920)
 * 3. Convert to WebP + AVIF
 * 4. Upload variants back to S3
 * 5. Update media record with dimensions and variant URLs
 */
export const imageWorker = new Worker<ImageJobData>(
  QUEUE_NAMES.IMAGE,
  async (job) => {
    const { mediaId, storageKey, mimeType } = job.data;
    console.log(`[ImageWorker] Optimizing media ${mediaId} (${storageKey})`);

    // TODO Phase 2: implement with sharp + @aws-sdk/client-s3
    // const original = await downloadFromS3(storageKey);
    // const variants = await generateVariants(original);
    // await uploadVariants(variants);
    // await db.update(media).set({ width, height, metadata: variants }).where(eq(media.id, mediaId));

    console.log(`[ImageWorker] Done optimizing ${mediaId}`);
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

imageWorker.on("failed", (job, err) => {
  console.error(`[ImageWorker] Job ${job?.id} failed:`, err.message);
});
