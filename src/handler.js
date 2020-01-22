'use strict';

const S3 = require('aws-sdk/clients/s3');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const createResHandler = require('@mooncake-dev/lambda-res-handler');
const bodyParser = require('@mooncake-dev/lambda-body-parser');
const handleAndSendError = require('./handle-error');
const validateAuthorizer = require('./validate-authorizer');
const validateScope = require('./validate-scope');
const schema = require('./schema');
const signUrl = require('./sign-url');
const standups = require('./standups');

const {
  CORS_ALLOW_ORIGIN,
  UPLOAD_FILE_SCOPE,
  DOWNLOAD_FILE_SCOPE,
  S3_RECORDINGS_BUCKET_NAME,
  S3_TRANSCODED_RECORDINGS_BUCKET_NAME,
  DYNAMODB_STANDUPS_TABLE_NAME,
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
 * recording for a standup
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
    validateScope(authorizer.scope, UPLOAD_FILE_SCOPE);

    const body = bodyParser.json(event.body);
    const {
      standupId,
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

    if (metadata.userId !== authorizer.userId) {
      const err = new Error('Incorrect User ID');
      err.statusCode = 400;
      err.details = 'Provide your own user ID.';
      throw err;
    }

    const { workspaceId } = authorizer;

    const standupExists = await standups.exists(
      documentClient,
      WORKSPACES_TABLE_NAME,
      workspaceId,
      standupId
    );
    if (!standupExists) {
      const err = new Error('Standup Not Found');
      err.statusCode = 404;
      err.details = 'You might not be a member of this standup';
      throw err;
    }

    const storageKey = `audio/${workspaceId}/${standupId}/${filename}`;
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
 * Lambda APIG proxy integration that creates a signed URL, to download a
 * standup update.
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
module.exports.createStandupUpdateDownloadUrl = async (event, context) => {
  try {
    const { authorizer } = event.requestContext;

    validateScope(authorizer.scope, DOWNLOAD_FILE_SCOPE);

    const body = bodyParser.json(event.body);
    const { fileKey } = schema.validateStandupUpdateDownload(body);

    // A valid S3 key looks like:
    // "audio/standups/:standupId/(D)D-(M)M-YYYY/:userId/:name.mp3"
    const [, , standupId] = fileKey.split('/');
    const userIsStandupMember = await standups.userIsMember(
      documentClient,
      DYNAMODB_STANDUPS_TABLE_NAME,
      standupId,
      authorizer.userId
    );
    if (!userIsStandupMember) {
      const err = new Error('Standup Not Found');
      err.statusCode = 404;
      err.details = 'You might not be a member of this standup';
      throw err;
    }

    // 5 minutes
    const expiresInSec = 60 * 5;

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
