'use strict';

const Joi = require('@hapi/joi');

const defaultJoi = Joi.defaults(_schema =>
  _schema.options({
    stripUnknown: true
  })
);

const _standupUpdateUpload = defaultJoi.object().keys({
  standupId: Joi.string().required(),

  mimeType: Joi.string()
    // Allow "audio/*"
    .regex(/^audio\/[\w-]+/, 'mime-type')
    .required(),

  filename: Joi.string()
    .required()
    .max(70),

  metadata: defaultJoi.object().keys({
    name: Joi.string()
      .alphanum()
      .max(70)
  })
});

const _standupUpdateDownload = defaultJoi.object().keys({
  fileKey: Joi.string()
    // A valid S3 key looks like:
    // "audio/standups/:standupId/(D)D-(M)M-YYYY/:userId/:name.mp3"
    .regex(
      /^audio\/standups\/.+\/\d\d?-\d\d?-\d\d\d\d\/.+\/.+\.mp3/,
      'file-key'
    )
    .required()
});

function _validate(data, schema) {
  const { error, value } = schema.validate(data);

  // For Joi "error" see:
  // https://github.com/hapijs/joi/blob/master/API.md#validationerror
  if (error) {
    const err = new Error('Invalid request data');
    err.statusCode = 400;
    err.details = error.details.map(e => e.message);
    throw err;
  }

  return value;
}

module.exports = {
  validateStandupUpdateUpload(data = {}) {
    return _validate(data, _standupUpdateUpload);
  },

  validateStandupUpdateDownload(data = {}) {
    return _validate(data, _standupUpdateDownload);
  }
};
