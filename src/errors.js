'use strict';

const errorCodes = {
	'ContextCorrupted': 'context corruption',
	'NoContextAvail': 'no context availiable',
	'ContextDoesNotExists': 'context does not exists',
	'ContextAlreadyExists': 'context was previously instantiated',
	'NoStartupScope': 'unable to start dive without initial function',
};

const util = require('util');
class DiveError extends Error {
	constructor(code, ...args) {
		const message = `cause -> ${errorCodes[code]}`;
		super(message, ...args);
		Error.captureStackTrace(this, DiveError);
		this.name = 'Dive Error';
		this.code = code;
		this.args = args;
		const stack = this.stack.split('\n');
		stack[1] = '';
		if (args.length) {
			stack[1] = args.map(arg => {
				return util.inspect(arg);
			}).join('\n');
		}
		this.stack = stack.join('\n');
	}
}

Object.entries(errorCodes).forEach(it => {
	const [code] = it;

	Object.defineProperty(module.exports, code, {
		get() {
			return (...args) => {
				return new DiveError(code, ...args);
			};
		}
	});
});