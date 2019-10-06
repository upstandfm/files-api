'use strict';

const validateScope = require('./validate-scope');

describe('validateScope(scope, requiredScope)', () => {
  it('throws with custom error when "scope" does not have "requiredScope"', () => {
    const scope = 'create:standup read:standups';
    const requiredScope = 'delete:standup';

    try {
      validateScope(scope, requiredScope);
    } catch (err) {
      expect(err).toHaveProperty('statusCode', 403);
      expect(err).toHaveProperty('message', 'Forbidden');
      expect(err).toHaveProperty(
        'details',
        `you need scope "${requiredScope}"`
      );
    }
  });
});
