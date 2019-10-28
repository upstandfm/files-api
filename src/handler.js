'use strict';

const S3 = require('aws-sdk/clients/s3');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const createResHandler = require('@mooncake-dev/lambda-res-handler');
const bodyParser = require('@mooncake-dev/lambda-body-parser');
const handleAndSendError = require('./handle-error');
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
  DYNAMODB_STANDUPS_TABLE_NAME
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
 * Lambda APIG proxy integration that creates a signed URL, to upload a standup
 * update.
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
module.exports.createStandupUpdateUploadUrl = async (event, context) => {
  try {
    const { authorizer } = event.requestContext;

    validateScope(authorizer.scope, UPLOAD_FILE_SCOPE);

    const body = bodyParser.json(event.body);
    const {
      standupId,
      mimeType,
      filename
    } = schema.validateStandupUpdateUpload(body);

    const userIsStandupMember = await standups.userIsMember(
      documentClient,
      DYNAMODB_STANDUPS_TABLE_NAME,
      standupId,
      authorizer.userId
    );
    if (!userIsStandupMember) {
      const err = new Error('Standup Not Found');
      err.statusCode = 404;
      err.details = 'You might not be a member of this standup.';
      throw err;
    }

    // NOTE: This can be potentially "tricky", especially with users uploading
    // across timezones
    // For a very first version we keep it simple like this, so it's not
    // paralyzing progress of building out the "core building blocks", but
    // it will be revisited
    const now = new Date();
    const monthIndex = now.getMonth();
    const dateKey = `${now.getDate()}-${monthIndex + 1}-${now.getFullYear()}`;

    // A valid storage key looks like:
    // "audio/standups/:standupId/(D)D-(M)M-YYYY/:userId/:filename.webm"
    const storageKey = `audio/standups/${standupId}/${dateKey}/${authorizer.userId}/${filename}`;

    // 5 minutes
    const expiresInSec = 60 * 5;

    const url = await signUrl.upload(
      s3Client,
      S3_RECORDINGS_BUCKET_NAME,
      storageKey,
      mimeType,
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
    // "audio/standups/:standupId/(D)D-(M)M-YYYY/:userId/:filename.mp3"
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
      err.details = 'You might not be a member of this standup.';
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
