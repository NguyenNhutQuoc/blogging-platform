import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

/**
 * Shared S3-compatible client.
 * In dev: connects to MinIO (http://localhost:9000).
 * In production: point S3_ENDPOINT to Cloudflare R2 / AWS S3.
 *
 * `forcePathStyle: true` is required for MinIO — AWS S3 uses virtual-hosted
 * style by default, but MinIO + most S3-compatible services need path style.
 */
export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});
