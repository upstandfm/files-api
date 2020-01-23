'use strict';

const validateAuthorizer = require('./authorizer');
const validateScope = require('./scope');

module.exports = {
  validateAuthorizer,
  validateScope
};
