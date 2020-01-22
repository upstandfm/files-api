'use strict';

const validateAuthorizer = require('./validate-authorizer');

const errDetails = `Corrupt authorizer data. Contact "support@upstand.fm"`;
const errStatusCode = 500;

describe('validateAuthorizer(data)', () => {
  it('throws without data', () => {
    try {
      validateAuthorizer();
    } catch (err) {
      expect(err).toHaveProperty('message', 'Missing Authorizer Data');
      expect(err).toHaveProperty('details', errDetails);
      expect(err).toHaveProperty('statusCode', errStatusCode);
    }
  });

  it('throws with missing user ID', () => {
    try {
      validateAuthorizer({});
    } catch (err) {
      expect(err).toHaveProperty('message', 'Missing User ID');
      expect(err).toHaveProperty('details', errDetails);
      expect(err).toHaveProperty('statusCode', errStatusCode);
    }
  });

  it('throws with missing workspace ID', () => {
    try {
      validateAuthorizer({ userId: '1' });
    } catch (err) {
      expect(err).toHaveProperty('message', 'Missing Workspace ID');
      expect(err).toHaveProperty('details', errDetails);
      expect(err).toHaveProperty('statusCode', errStatusCode);
    }
  });

  it('does not throw with valid format', () => {
    try {
      validateAuthorizer({ userId: '1', workspaceId: '1' });
    } catch (err) {
      expect(err).toBe(null);
    }
  });
});
