'use strict';

/**
 * Handle errors by:
 *  - Capturing errors and sending them to Serverless Dashboard.
 *  - Sending a JSON response to the client with error information.
 *
 * Captured errors can be found here:
 * https://dashboard.serverless.com/tenants/upstandfm/applications/api/services/files-api/stage/prod/region/eu-central-1#service-overview=alerts
 *
 * @param {Object} context - AWS lambda context
 * @param {Object} err
 * @param {Function} sendRes - Instance of "@mooncake-dev/lambda-res-handler"
 *
 * @return {Object} HTTP res
 */
module.exports = function handleAndSendError(context, err, sendRes) {
  // Provided by Serverless Framework
  if (context && context.captureError) {
    context.captureError(err);
  }

  const statusCode = err.statusCode || 500;
  const data = {
    message: err.message,
    details: err.details
  };
  return sendRes.json(statusCode, data);
};
