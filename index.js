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

var currentContext;
const changeContext = (value) => {
	currentContext = value;
	return value;
};

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
};

Object.defineProperty(state, 'currentContext', {
	get () {
		return currentContext;
	},
	set (value) {
		return changeContext(value);
	},
	configurable : false,
	enumerable   : false
});
Object.defineProperty(state, 'ctx', {
	get () {
		return currentContext;
	},
	set (value) {
		return changeContext(value);
	},
	configurable : false,
	enumerable   : false
});

// basic functionality
const dive = function (context, ctx, brfn, ..._args) {
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
		const prevContext = state.currentContext;
		state.currentContext = base._currentContext;
		state.baseRunning = true;
		const answer = run(...args);
		state.baseRunning = false;
		state.currentContext = prevContext;
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

dive.disableFunctions = () => {
	delete Function.prototype.dive;
	delete Function.prototype._dive;
};

dive.useGlobal = () => {
	Object.defineProperty(global, 'currentContext', {
		get () {
			return state.currentContext;
		},
		configurable : false,
		enumerable   : true
	});
};

dive.enableEIDs = () => {
	state.eidsEnabled = true;
};
dive.disableEIDs = () => {
	state.eidsEnabled = false;
};

dive.put = (context) => {
	state.currentContext = context;
};



// async hooks
const async_hooks = require('async_hooks');

const dropsTypes = ['PROMISE', 'Timeout', 'TickObject'].reduce((o, type) => {
	o[type] = true;
	return o;
}, {});

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

const init = (asyncId, type, triggerId, resource) => {
	
	if (state.currentContext !== undefined) {
		
		// if we have some context
		// we will save it to hooks storage
		const ctx = {
			
			// easy, we definetely
			// have to dive deeper
			// with this upon the stage
			ctx : state.currentContext,
			
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
		it.mix = state.currentContext;
		state.currentContext = it.ctx;
	}
};


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
		state.currentContext = state.asyncIdHooks[asyncId].mix;
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

dive.stopTracing = () => {
	const ctx = state.currentContext;
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
	state.currentContext = undefined;
	return ctx;
};
dive.clean = dive.stopTracing;


const promiseResolve = (asyncId) => {
	if (!state.baseRunning) {
		drop(asyncId);
		state.currentContext = undefined;
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
		state.asyncIdHooks = {};
		asyncHook.disable();
		return dive;
	};
}

module.exports = dive;
