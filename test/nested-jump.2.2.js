'use strict';

const dive = require('../src/index');
const test = require('./lib/nested.2');

describe('nested jump from other code 2.2', () => {
	before(() => {
		dive.enableAsyncHooks();
	});
	it('should have a context', test);
	after(() => {
		dive.emergeAll();
	});
});
