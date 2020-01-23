'use strict';

/**
 * Validate authorizer data.
 *
 * @param {Object} data
 *
 * @throws {Error} Validation Error
 */
module.exports = function validateAuthorizer(data) {
  const detailsMsg = `Corrupt authorizer data. Contact "support@upstand.fm"`;

  if (!data) {
    const err = new Error('Missing Authorizer Data');
    err.statusCode = 500;
    err.details = detailsMsg;
    throw err;
  }

  if (!data.userId) {
    const err = new Error('Missing User ID');
    err.statusCode = 500;
    err.details = detailsMsg;
    throw err;
  }

  if (!data.workspaceId) {
    const err = new Error('Missing Workspace ID');
    err.statusCode = 500;
    err.details = detailsMsg;
    throw err;
  }
};
