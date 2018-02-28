'use strict';

/**
 * 
 * MIT License
 * please use the link below for notice
 * https://github.com/wentout/dive
 * 
 * 
 *   ABOUT
 * 
 * It utilize the ability of patching function callbacks
 * with other functions, and then, when them are called
 * it uses simple technique of restore and rollback
 * the context, given to the 1st execution funtion
 * 
 */

var currentContext;

// basic functionality
const dive = function (context, ctx, brfn, ..._args) {
	if (context === undefined) {
		context = currentContext;
	}
	let fn = this;
	if (typeof fn !== 'function') {
		// Call as an Object Property
		if (context && typeof context[ctx] == 'function') {
			fn = context[ctx];
			ctx = context;
			context = brfn;
		}
	}
	const base = function () {
		const run = fn.bind(ctx || this);
		const args = [...arguments].map(arg => {
			if (typeof arg == 'function') {
				arg = dive.call(arg, context, ctx || this, brfn);
			}
			return arg;
		});
		const prevContext = currentContext;
		currentContext = base._currentContext;
		const answer = run(...args);
		currentContext = prevContext;
		if (typeof answer == 'function' && !brfn) {
			return dive.call(answer, context);
		}
		return answer;
	};
	base._currentContext = context;
	if (_args.length) {
		// immediate invocation
		base.apply(ctx || this, _args);
	}
	return base;
};


dive.enableFunctions = () => {
	Object.defineProperty(Function.prototype, 'dive', {
		get () {
			return dive.call(this, currentContext);
		},
		enumerable   : true
	});	
	Function.prototype._dive = dive;
};
dive.disableFunctions = () => {
	delete Function.prototype.dive;
	delete Function.prototype._dive;
};

const setCurrentContextProp = (obj) => {
	Object.defineProperty(obj, 'currentContext', {
		get () {
			return currentContext;
		},
		configurable : false,
		enumerable   : true
	});
};
dive.setCurrentContextProp = setCurrentContextProp;
setCurrentContextProp(dive);
dive.useGlobal = () => {
	setCurrentContextProp(global);
};
dive.put = (context) => {
	currentContext = context;
};



// async hooks
const async_hooks = require('async_hooks');

const hashAllHooks = {};
Object.defineProperty(dive, 'hashAllHooks', {
	get () {
		return hashAllHooks;
	},
	configurable : false,
	enumerable   : true
});

const drop = (asyncId) => {
	// rolling back
	if (hashAllHooks[asyncId]) {
		currentContext = hashAllHooks[asyncId].mix;
		delete hashAllHooks[asyncId];
	}
};
const hooks = {
	init (asyncId, type, triggerId, resource) {
		const ctx = currentContext;
		if (ctx !== undefined) {
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
			// rolling forward
			const mix = currentContext;
			hashAllHooks[asyncId].mix = currentContext;
			currentContext = hashAllHooks[asyncId].ctx;
		}
	},
	after   : drop,
	destroy : drop
};

dive.asyncHook = null;
if (async_hooks) {
	const asyncHook = async_hooks.createHook(hooks);
	dive.asyncHook = asyncHook;
	
	const getExecId = () => {
		return async_hooks.executionAsyncId();
	};
	dive.enableAsyncHooks = () => {
		asyncHook.enable();
		dive.getExecId = getExecId;
		return dive;
	};
	dive.disableAsyncHooks = () => {
		hashAllHooks = {};
		delete dive.getExecId;
		asyncHook.disable();
		return dive;
	};
}

module.exports = dive;
