export function rewriteStorageUrl(url) {

  return url.replace(

    process.env.S3_ENDPOINT,

    process.env.PUBLIC_STORAGE_URL

  );

}