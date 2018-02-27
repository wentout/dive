'use strict';

const dive = function (context, ctx, brfn) {
	const fn = this;
	const base = function () {
		const run = fn.bind(ctx || this);
		const args = [...arguments].map(arg => {
			if (typeof arg == 'function') {
				arg = dive.call(arg, context, ctx || this, brfn);
			}
			return arg;
		});
		const prevContext = global._currentContext;
		global._currentContext = base._currentContext;
		const answer = run(...args);
		if (prevContext) {
			global._currentContext = prevContext;
		} else {
			delete global._currentContext;
		}
		if (typeof answer == 'function' && !brfn) {
			return dive.call(answer, context);
		}
		return answer;
	};
	base._currentContext = context;
	return base;
};

const objectMethodDive = (obj, methodName, context, breakResultFn) => {
	return dive.call(obj[methodName], context, obj, breakResultFn);
};
dive.object = objectMethodDive;

dive.enable = () => {
	Function.prototype.dive = dive;
};
dive.disable = () => {
	delete Function.prototype.dive;
};

const async_hooks = require('async_hooks');
const hashAllHooks = {};
const drop = (asyncId) => {
	// rolling back
	if (hashAllHooks[asyncId]) {
		global._currentContext = hashAllHooks[asyncId].mix;
		delete hashAllHooks[asyncId];
	}
};
const hooks = {
	init (asyncId, type, triggerId, resource) {
		const ctx = global._currentContext;
		if (ctx) {
			hashAllHooks[asyncId] = {
				ctx,
				type,
				asyncId,
				triggerId,
				resource
			};
		}
	},
	before (asyncId) {
		if (hashAllHooks[asyncId]) {
			const mix = global._currentContext;
			if (mix) {
				// rolling forward
				hashAllHooks[asyncId].mix = mix;
			}
			global._currentContext = hashAllHooks[asyncId].ctx;
		}
	},
	after   : drop,
	destroy : drop
};

const asyncHook = async_hooks.createHook(hooks);
asyncHook.enable();
dive.asyncHooksEnable = () => {
	asyncHook.enable();
};
dive.asyncHooksDisable = () => {
	hashAllHooks = {};
	asyncHook.disable();
};
dive.hashAllHooks = hashAllHooks;
dive.getExecId = () => {
	return async_hooks.executionAsyncId();
};

module.exports = dive;
