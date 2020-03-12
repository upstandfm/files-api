'use strict';

const S3 = require('aws-sdk/clients/s3');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const createResHandler = require('@mooncake-dev/lambda-res-handler');
const bodyParser = require('@mooncake-dev/lambda-body-parser');
const handleAndSendError = require('./handle-error');
const { validateAuthorizer, validateScope } = require('./validators');
const schema = require('./schema');
const signUrl = require('./sign-url');
const channels = require('./channels');

const {
  CORS_ALLOW_ORIGIN,
  UPLOAD_AUDIO_SCOPE,
  DOWNLOAD_AUDIO_SCOPE,
  S3_RECORDINGS_BUCKET_NAME,
  S3_TRANSCODED_RECORDINGS_BUCKET_NAME,
  WORKSPACES_TABLE_NAME
} = process.env;

const defaultHeaders = {
  'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN
};
const sendRes = createResHandler(defaultHeaders);

const s3Client = new S3();

// For more info see:
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#constructor-property
const documentClient = new DynamoDB.DocumentClient({
  convertEmptyValues: true
});

/**
 * Lambda APIG proxy integration that creates a signed URL to upload an audio
 * recording for a standup.
 *
 * @param {Object} event - HTTP input
 * @param {Object} context - AWS lambda context
 *
 * @return {Object} HTTP output
 *
 * For more info on HTTP input see:
 * https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 *
 * For more info on AWS lambda context see:
 * https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 *
 * For more info on HTTP output see:
 * https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-output-format
 */
module.exports.createAudioUploadUrl = async (event, context) => {
  try {
    const { authorizer } = event.requestContext;

    validateAuthorizer(authorizer);
    validateScope(authorizer.scope, UPLOAD_AUDIO_SCOPE);

    const body = bodyParser.json(event.body);
    const {
      mimeType,

      // "filename" includes a file extension, e.g. "1a2z3x.webm"
      filename,

      // Note that any user defined metadata needs to be sent as a custom header
      // in the request using the signed URL to upload data.
      // This header must "match" the metadata "key" itself, i.e.
      // "x-amz-meta-:key".
      // For more info see: https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html
      metadata
    } = schema.validateAudioUpload(body);

    // Since we do a "direct upload" from the client, the client must provide
    // the metadata itself. And therefore we have to check if it provides the
    // "correct" values for the "workspaceId", "userId", "recordingId".

    if (metadata['workspace-id'] !== authorizer.workspaceId) {
      const err = new Error('Incorrect workspace id');
      err.statusCode = 400;
      err.details = 'Provide your own workspace id';
      throw err;
    }

    if (metadata['user-id'] !== authorizer.userId) {
      const err = new Error('Incorrect user id');
      err.statusCode = 400;
      err.details = 'Provide your own user id';
      throw err;
    }

    const [fileId] = filename.split('.');
    if (metadata['recording-id'] !== fileId) {
      const err = new Error('Incorrect recording id');
      err.statusCode = 400;
      err.details = 'The recording id must match the id used in the filename';
      throw err;
    }

    // We also have to verify that the channel exists in the user's
    // workspace. If it exists it also means the user has access to the channel
    const channelExists = await channels.exists(
      documentClient,
      WORKSPACES_TABLE_NAME,
      authorizer.workspaceId,
      metadata['channel-id']
    );

    if (!channelExists) {
      const err = new Error('Not found');
      err.statusCode = 404;
      err.details = `You might not have access to this channel, or it doesn't exist`;
      throw err;
    }

    const storageKey = `audio/${authorizer.workspaceId}/${metadata['channel-id']}/${filename}`;
    const expiresInSec = 60 * 5; // 5 minutes
    const url = await signUrl.upload(
      s3Client,
      S3_RECORDINGS_BUCKET_NAME,
      storageKey,
      mimeType,
      expiresInSec,
      metadata
    );

    const resData = {
      url
    };
    return sendRes.json(201, resData);
  } catch (err) {
    return handleAndSendError(context, err, sendRes);
  }
};

/**
 * Lambda APIG proxy integration that creates a signed URL to download an audio
 * recording for a standup.
 *
 * @param {Object} event - HTTP input
 * @param {Object} context - AWS lambda context
 *
 * @return {Object} HTTP output
 *
 * For more info on HTTP input see:
 * https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 *
 * For more info on AWS lambda context see:
 * https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 *
 * For more info on HTTP output see:
 * https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-output-format
 */
module.exports.createAudioDownloadUrl = async (event, context) => {
  try {
    const { authorizer } = event.requestContext;

    validateAuthorizer(authorizer);
    validateScope(authorizer.scope, DOWNLOAD_AUDIO_SCOPE);

    const body = bodyParser.json(event.body);
    const { fileKey } = schema.validateAudioDownload(body);

    // A valid S3 file key looks like:
    // "audio/:workspaceId/:channelId/:recordingId.mp3"
    const [, , channelId] = fileKey.split('/');

    // We have to verify that the channel exists in the user's
    // workspace. If it exists it also means the user has access to the channel
    const channelExists = await channels.exists(
      documentClient,
      WORKSPACES_TABLE_NAME,
      authorizer.workspaceId,
      channelId
    );

    if (!channelExists) {
      const err = new Error('Not found');
      err.statusCode = 404;
      err.details = `You might not have access to this channel, or it doesn't exist`;
      throw err;
    }

    const expiresInSec = 60 * 5; // 5 minutes
    const url = await signUrl.download(
      s3Client,
      S3_TRANSCODED_RECORDINGS_BUCKET_NAME,
      fileKey,
      expiresInSec
    );

    const resData = {
      url
    };
    return sendRes.json(201, resData);
  } catch (err) {
    return handleAndSendError(context, err, sendRes);
  }
};
