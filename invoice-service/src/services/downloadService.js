import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { s3 } from "../config/s3.js";

export async function createSignedDownloadUrl(
  bucket,
  fileKey
) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: fileKey
  });

  return getSignedUrl(
    s3,
    command,
    {
      expiresIn: 300
    }
  );
}