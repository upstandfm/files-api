'use strict';

module.exports = {
  /**
   * Create a signed URL to upload a file directly to S3.
   *
   * @param {Object} client - S3 client
   * @param {String} bucketName - Name of the S3 bucket
   * @param {String} storageKey - S3 bucket storage key (i.e. "storage path")
   * @param {String} mimeType
   * @param {Number} expiresInSec - Time before the URL expires, default expiration is 900 sec (15 min) when omitted
   * @param {Object} metadata - S3 object user defined metadata
   *
   * @return {Promise} Resolves with a signed URL
   *
   * For more information see:
   * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getSignedUrl-property
   */
  upload(client, bucketName, storageKey, mimeType, expiresInSec, metadata) {
    return new Promise((resolve, reject) => {
      const params = {
        Bucket: bucketName,
        Key: storageKey,
        ContentType: mimeType,
        ServerSideEncryption: 'AES256',
        Expires: expiresInSec,
        Metadata: metadata
      };

      client.getSignedUrl('putObject', params, (err, url) => {
        if (err) {
          return reject(err);
        }

        resolve(url);
      });
    });
  },

  /**
   * Create a signed URL to download a file directly to S3.
   *
   * @param {Object} client - S3 client
   * @param {String} bucketName - Name of the S3 bucket
   * @param {String} storageKey - S3 bucket storage key (i.e. "storage path")
   * @param {Number} expiresInSec - Time before the URL expires, default expiration is 900 sec (15 min) when omitted
   *
   * @return {Promise} Resolves with a signed URL
   *
   * For more information see:
   * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getSignedUrl-property
   */
  download(client, bucketName, storageKey, expiresInSec) {
    return new Promise((resolve, reject) => {
      const params = {
        Bucket: bucketName,
        Key: storageKey,
        Expires: expiresInSec
      };

      client.getSignedUrl('getObject', params, (err, url) => {
        if (err) {
          return reject(err);
        }

        resolve(url);
      });
    });
  }
};
