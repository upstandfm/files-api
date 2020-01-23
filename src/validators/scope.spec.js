'use strict';

const validateScope = require('./scope');

describe('validateScope(scope, requiredScope)', () => {
  it('throws with custom error when "scope" does not have "requiredScope"', () => {
    const scope = '';
    const requiredScope = 'upload:file';

    try {
      validateScope(scope, requiredScope);
    } catch (err) {
      expect(err).toHaveProperty('statusCode', 403);
      expect(err).toHaveProperty('message', 'Forbidden');
      expect(err).toHaveProperty(
        'details',
        `You need scope "${requiredScope}"`
      );
    }
  });
});
