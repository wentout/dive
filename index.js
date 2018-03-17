'use strict';

/**
 * 
 * MIT License
 * please use the link below for notice
 * https://github.com/wentout/dive
 * 
 *   ABOUT
 * 
 * It utilize the ability of patching function callbacks
 * with other functions, and then, when them are called
 * it uses simple technique of restore and rollback
 * the context, given to the 1st execution funtion
 * 
 */

/**
 * variable to store our current context
 * when syncronous code is runnign
 * for ability to give it by request
 */
var currentContext;
/**
 * about to change currentContext
 * just an abstraction layer
 * @param {any} value 
 */
const changeContext = (value) => {
	currentContext = value;
	return value;
};

/**
 * our current state
 * all hooks, all contexts
 */
const state = {
	// [asyncId] == ctx
	asyncIdHooks : {},
	
	// [triggerId][asyncId] == ctx
	triggerHooks : {},
	// [eid][asyncId] == ctx
	eidHooks     : {},
	// [tid][asyncId] == ctx
	tidHooks     : {},
	
	baseRunning  : false,
	hookRunning  : false,
	
	// about to additionally enable
	// eids for context selection
	eidsEnabled  : false,
	
	// experimental functionality
	// means I don't know if this is
	// a good way to do so
	// for me -- I'm unable to check
	// seems good, and nobody issued yet
	experimentalEnabled : true
};

const currentContextProp = {
	get () {
		return currentContext;
	},
	set (value) {
		return changeContext(value);
	},
	configurable : false,
	enumerable   : false
};

Object.defineProperty(state, 'currentContext', currentContextProp);
Object.defineProperty(state, 'ctx', currentContextProp);

// basic functionality
/**
 * syncronous function call carrator
 * with function arguments recursion
 * @param {string} context stuff to put to currentContext
 * @param {any} ctx "this" for nested calls
 * @param {boolean} brfn if sync run of wrapped function
 *                       returns other function
 *                       here we are able to break
 *                       that function wrapping
 * @param {array} _args other arguments for wrapped function call
 * @param {function} this function for wrapping
 */
const dive = function (context, ctx, brfn, ..._args) {
	let fn = this;
	if (typeof fn !== 'function') {
		// Call as an Object Property
		if (context && typeof context[ctx] == 'function') {
			fn = context[ctx];
			ctx = context;
			context = brfn;
		} else if (typeof context == 'function') {
			fn = context;
			context = ctx;
			ctx = brfn;
			if (_args && _args.length) {
				brfn = _args[0];
				if (_args.length > 1) {
					_args = args.slice(1);
				}
			}
		}
	}
	if (typeof fn !== 'function') {
		return;
	}
	const base = function () {
		const run = fn.bind(ctx || this);
		const args = [...arguments].map(arg => {
			if (typeof arg == 'function') {
				arg = dive.call(arg, context, ctx || this, brfn);
			}
			return arg;
		});
		const prevContext = state.ctx;
		state.ctx = base._currentContext;
		state.baseRunning = true;
		const answer = run(...args);
		state.baseRunning = false;
		state.ctx = prevContext;
		if (typeof answer == 'function' && !brfn) {
			// return dive.call(answer, context || prevContext);
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

[
	'currentContext',
	'asyncIdHooks',
	'triggerHooks',
	'eidsEnabled',
	'eidHooks',
	'tidHooks'
].forEach(name => {
	Object.defineProperty(dive, name, {
		get () {
			return state[name];
		},
		configurable : false,
		enumerable   : true
	});	
});

Object.defineProperty(dive, '_state', {
	get () {
		return state;
	},
	configurable : false,
	enumerable   : false
});

/**
 * enable Function.prototype.dive patch
 */
dive.enableFunctions = () => {
	if (Function.prototype.dive) {
		return;
	}
	Function.prototype.dive = dive;
	Object.defineProperty(Function.prototype, '_dive', {
		get () {
			return dive.bind(this);
		},
		enumerable   : true
	});	
};

/**
 * disable Function.prototype.dive patch
 */
dive.disableFunctions = () => {
	delete Function.prototype.dive;
	delete Function.prototype._dive;
};

dive.enableExperimental = () => {
	state.experimentalEnabled = true;
};
dive.disableExperimental = () => {
	state.experimentalEnabled = false;
};

const ctxProp = {
	get () {
		return state.ctx;
	},
	configurable : false,
	enumerable   : true
};
Object.defineProperty(dive, 'ctx', ctxProp);

/**
 * place a pointer of currentContext to global
 */
dive.useGlobal = () => {
	Object.defineProperty(global, 'currentContext', ctxProp);
};

/**
 * enable additional serach through EIDs
 * when trying to patch current ASYNC context
 */
dive.enableEIDs = () => {
	state.eidsEnabled = true;
};
/**
 * disabling eidsEnabled
 */
dive.disableEIDs = () => {
	state.eidsEnabled = false;
};

/**
 * replace current context with other stuff
 * @param {string} context new context
 */
dive.put = (context) => {
	state.ctx = context;
};



// async hooks
const async_hooks = require('async_hooks');

const dropsTypes = ['PROMISE', 'Timeout', 'TickObject'].reduce((o, type) => {
	o[type] = true;
	return o;
}, {});

/**
 * place current situation to state
 * @param {any} ctx state context
 */
const saveHooksContext = (ctx) => {
	
	const asyncId   = ctx.asyncId;
	const triggerId = ctx.triggerId;
	
	if (!state.asyncIdHooks[ctx.asyncId]) {
		state.asyncIdHooks[ctx.asyncId] = ctx;
	}
	
	if (!state.triggerHooks[triggerId]) {
		state.triggerHooks[triggerId] = {};
	}
	if (!state.triggerHooks[triggerId][asyncId]) {
		state.triggerHooks[triggerId][asyncId] = ctx;
	}
	
	// tid & eid
	const eid = dive.eid;
	const tid = dive.tid;
	
	if(!state.eidHooks[eid]) {
		state.eidHooks[eid] = {};
	}
	if (!state.eidHooks[eid][asyncId]) {
		state.eidHooks[eid][asyncId] = ctx;
	}
	
	if(!state.tidHooks[tid]) {
		state.tidHooks[tid] = {};
	}
	if (!state.tidHooks[tid][asyncId]) {
		state.tidHooks[tid][asyncId] = ctx;
	}
	
	// if (typeof ctx.resource.callback == 'function') {
	// 	ctx.resource.callback = dive.call(ctx.resource.callback, ctx.ctx);
	// }
};

/**
 * standard async_hooks init callback
 * 
 * this function tries to memorise currentContext
 * to investigate it from state when it will be necessary
 * 
 * @param {number} asyncId 
 * @param {string} type 
 * @param {number} triggerId 
 * @param {any} resource 
 */
const init = (asyncId, type, triggerId, resource) => {
	
	if (state.ctx !== undefined) {
		
		// if we have some context
		// we will save it to hooks storage
		const ctx = {
			
			// easy, we definetely
			// have to dive deeper
			// with this upon the stage
			ctx : state.ctx,
			
			// how many context were nested
			// from this current context
			probability : 0,
			
			// our tracking IDs
			asyncId,
			triggerId,
			
			// additional debugging data,
			// may be we need too look on
			type,
			resource,
			
		};
		return saveHooksContext(ctx);
	}
	
	if (!state.experimentalEnabled) {
		return;
	}
	// maybe new context born from calls
	const prevId = asyncId - 1;
	
	const len = Object.keys(state.asyncIdHooks).length;
	if (len) {
		// 2 == magic number, it is from tracing
		// first -- birth of new context
		// second -- birth of this context
		const prev = state.eidHooks[prevId - 2];
		const it = state.asyncIdHooks[prevId];
		// this asyncId does not exists
		// cause init runs only once
		if (
			// but previous execution does
			// and this run is directly after
			it && it.resource &&
			// next tick hop has no callback
			!it.resource.callback &&
			// and if probability == 0
			// it means it is still 
			// inside of our context ?
			it.probability == 0
			// and also we are able
			// to check tracing in deep
			// we must care the following
			&&
			prev
			&&
			prev[prevId - 1]
			&&
			prev[prevId - 1].ctx == it.ctx
			// &&
			// !dropsTypes[type]
		) {
			
			const ctx = {
				
				// follow the previous
				ctx         : it.ctx,
				
				// but increase the probability
				probability : it.probability + 1,
				
				asyncId,
				triggerId,
				
				type,
				resource,
				
			};
			saveHooksContext(ctx);
		}
	} else {
		const prev = state.eidHooks[prevId - 1];
		if (!prev) {
			return;
		}
		// this context 
		const it = prev[prevId];
		if (
			it && it.resource &&
			it.resource.callback &&
			it.probability == 0 &&
			// definetely this is it ;^)
			it.resource.callback._currentContext == it.currentContext
		) {
			const ctx = {
				ctx         : it.ctx,
				probability : it.probability + 1,
				
				asyncId,
				triggerId,
				
				type,
				resource,
				
			};
			saveHooksContext(ctx);
		}
	}
};

/**
 * standard async_hooks before callback
 * this function patches currentContext
 * @param {number} asyncId 
 */
const before = (asyncId) => {
	// roll up everything
	const eid = dive.eid;
	let it = state.asyncIdHooks[asyncId];
	if (!it && dive.eidsEnabled){
		it = state.asyncIdHooks[eid][asyncId];
	}
	if (it) {
		// here we have context
		// and able to apply it to new code
		state.hookRunning = true;
		// rolling forward
		it.mix = state.ctx;
		state.ctx = it.ctx;
	}
};

/**
 * cleanup method when no tracking
 * of asyncId is necessary anymore
 * @param {number} asyncId 
 */
const drop = (asyncId) => {
	
	// 1. rolling back hook running state
	state.hookRunning = false;
	
	// tid & eid
	const eid = dive.eid;
	const tid = dive.tid;
	
	// seekeing stored hook
	const aidHook = state.asyncIdHooks[asyncId];
	
	let triggerId;
	if (aidHook) {
		state.ctx = state.asyncIdHooks[asyncId].mix;
		triggerId = state.asyncIdHooks[asyncId].triggerId;
		delete state.asyncIdHooks[asyncId];
		delete state.asyncIdHooks[eid];
		delete state.asyncIdHooks[tid];
	}
	
	if (state.eidHooks[eid]) {
		delete state.eidHooks[eid][asyncId];
		delete state.eidHooks[eid][triggerId];
		delete state.eidHooks[eid][tid];
	}
	if (state.eidHooks[asyncId]) {
		delete state.eidHooks[triggerId];
		delete state.eidHooks[tid];
	}
	
	// we don't actually need this all
	// will rid of it the next versions
	const dropIDs = [asyncId, eid, tid];
	if (triggerId !== undefined) {
		dropIDs.push(triggerId);
	}
	dropIDs.forEach((id) => {
		if (state.triggerHooks[id]) {
			delete state.triggerHooks[id];
		}
		if (state.tidHooks[id]) {
			delete state.tidHooks[id];
		}
	});
	
};

/**
 * stops all tracers for currentContext
 */
dive.stopTracing = () => {
	const ctx = state.ctx;
	if (!ctx) {
		return;
	}
	Object.keys(state.asyncIdHooks).forEach(id => {
		if (state.asyncIdHooks[id].ctx == ctx) {
			delete state.asyncIdHooks[id];
			delete state.triggerHooks[id];
		}
	});
	['eidHooks', 'tidHooks', 'triggerHooks'].forEach(type => {
		Object.keys(state[type]).forEach(hid => {
			const hooks = state[type][hid];
			Object.keys(hooks).forEach(id => {
				if (hooks[id].ctx == ctx) {
					delete state[type][hid][id];
				}
			});
			if (!Object.keys(state[type][hid]).length) {
				delete state[type][hid];
			}
		});
	});
	state.ctx = undefined;
	return ctx;
};
dive.clean = dive.stopTracing;

/**
 * standard promise async_hook calback
 * @param {number} asyncId 
 */
const promiseResolve = (asyncId) => {
	if (!state.baseRunning) {
		drop(asyncId);
		state.ctx = undefined;
	}
};

dive.hooks = {
	init,
	before,
	after   : drop,
	destroy : drop,
	promiseResolve
};

dive.asyncHook = null;
if (async_hooks) {
	const asyncHook = async_hooks.createHook(dive.hooks);
	dive.asyncHook = asyncHook;
	dive.async_hooks = async_hooks;
	
	Object.defineProperty(dive, 'eid', {
		get () {
			return async_hooks.executionAsyncId();
		},
		configurable : false,
		enumerable   : true
	});
	Object.defineProperty(dive, 'tid', {
		get () {
			return async_hooks.triggerAsyncId();
		},
		configurable : false,
		enumerable   : true
	});
	
	dive.enableAsyncHooks = () => {
		asyncHook.enable();
		return dive;
	};
	dive.disableAsyncHooks = () => {
		[
			'asyncIdHooks',
			'triggerHooks',
			'eidsEnabled',
			'eidHooks',
			'tidHooks'
		].forEach(it => {
			state[it] = {};
		});
		asyncHook.disable();
		return dive;
	};
}

module.exports = dive;
