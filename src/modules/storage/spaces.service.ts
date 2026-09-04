import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { env } from '@/config/env.js';

let spacesClient: S3Client | null = null;

export function isSpacesConfigured(): boolean {
  return Boolean(
    env.spaces.accessKey &&
      env.spaces.secretKey &&
      env.spaces.bucket &&
      env.spaces.region,
  );
}

function getSpacesClient(): S3Client {
  if (!isSpacesConfigured()) {
    throw new Error('DigitalOcean Spaces is not configured.');
  }

  if (!spacesClient) {
    spacesClient = new S3Client({
      endpoint: env.spaces.endpoint,
      region: env.spaces.region,
      credentials: {
        accessKeyId: env.spaces.accessKey!,
        secretAccessKey: env.spaces.secretKey!,
      },
      forcePathStyle: false,
    });
  }

  return spacesClient;
}

export function buildSpacesPublicUrl(fileKey: string): string {
  const cdnBase = env.spaces.cdnBase?.replace(/\/$/, '');
  if (cdnBase) {
    return `${cdnBase}/${fileKey}`;
  }

  return `https://${env.spaces.bucket}.${env.spaces.region}.digitaloceanspaces.com/${fileKey}`;
}

export async function uploadToSpaces(
  buffer: Buffer,
  mimeType: string,
  fileKey: string,
): Promise<string> {
  const client = getSpacesClient();

  await client.send(
    new PutObjectCommand({
      Bucket: env.spaces.bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
      ACL: 'public-read',
    }),
  );

  return buildSpacesPublicUrl(fileKey);
}
