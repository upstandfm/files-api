'use strict';

const Joi = require('@hapi/joi');

const defaultJoi = Joi.defaults(_schema =>
  _schema.options({
    stripUnknown: true
  })
);

const _audioUpload = defaultJoi.object().keys({
  mimeType: Joi.string()
    .required()
    .valid('audio/webm'),

  filename: Joi.string()
    // A filename has the format ":fileId.webm", e.g. "1a2z3x.webm"
    // The "fileId" consists of 7 to 14 URL friendly characters, for more info
    // see: https://github.com/dylang/shortid
    .regex(/^[a-zA-Z-0-9_-]{7,14}.webm$/, 'filename')
    .required(),

  metadata: defaultJoi.object().keys({
    'workspace-id': Joi.string().required(),
    'user-id': Joi.string().required(),
    'channel-id': Joi.string().required(),
    'recording-id': Joi.string().required(),

    date: Joi.string()
      // A valid date has format "YYYY-MM-DD"
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date')
      .required(),

    name: Joi.string()
      // Empty string is not allowed by default
      // For more info see:
      // https://hapi.dev/family/joi/?v=16.1.8#string
      .empty('')
      .regex(/[a-zA-Z0-9 ]*/, 'name')
      .max(70)
  })
});

const _audioDownload = defaultJoi.object().keys({
  fileKey: Joi.string()
    // A valid S3 file key looks like:
    // "audio/:workspaceId/:channelId/:recordingId.mp3"
    .regex(
      /^audio\/[a-zA-Z-0-9_-]{7,14}\/[a-zA-Z-0-9_-]{7,14}\/[a-zA-Z-0-9_-]{7,14}\.mp3$/,
      'file-key'
    )
    .required()
});

function _validate(data, schema) {
  const { error: joiErr, value } = schema.validate(data);

  // For Joi error see:
  // https://github.com/hapijs/joi/blob/master/API.md#validationerror
  if (joiErr) {
    const err = new Error('Invalid request data');
    err.statusCode = 400;
    err.details = joiErr.details.map(e => e.message);
    throw err;
  }

  return value;
}

module.exports = {
  validateAudioUpload(data = {}) {
    return _validate(data, _audioUpload);
  },

  validateAudioDownload(data = {}) {
    return _validate(data, _audioDownload);
  }
};
