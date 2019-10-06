'use strict';

const S3 = require('aws-sdk/clients/s3');
const createResHandler = require('@mooncake-dev/lambda-res-handler');
const bodyParser = require('@mooncake-dev/lambda-body-parser');
const handleAndSendError = require('./handle-error');
const validateScope = require('./validate-scope');
const schema = require('./schema');
const signUrl = require('./sign-url');

const {
  CORS_ALLOW_ORIGIN,
  UPLOAD_FILE_SCOPE,
  S3_MEDIA_BUCKET_NAME
} = process.env;

const defaultHeaders = {
  'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN
};
const sendRes = createResHandler(defaultHeaders);

const s3Client = new S3();

/**
 * Lambda APIG proxy integration that creates signed URL, to upload a standup
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
    const { standupId, mimeType, filename } = schema.validateStandupUpdateFile(
      body
    );

    const now = new Date();
    const dateKey = `${now.getDate()}-${now.getMonth()}-${now.getFullYear()}`;

    const storageKey = `audio/standups/${standupId}/${dateKey}/${authorizer.userId}/${filename}`;

    // 5 minutes
    const expiresInSec = 60 * 5;

    const url = await signUrl.upload(
      s3Client,
      S3_MEDIA_BUCKET_NAME,
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
