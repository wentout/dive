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
	
	// DEBUGING_ON  : false
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

['currentContext', 'asyncIdHooks', 'triggerHooks', 'eidsEnabled'].forEach(name => {
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

const saveHooksContext = (ctx) => {
	
	const asyncId   = ctx.asyncId;
	const triggerId = ctx.triggerId;
	
	if (!state.asyncIdHooks[ctx.asyncId]) {
		state.asyncIdHooks[ctx.asyncId] = ctx;
	// } else if (state.DEBUGING_ON) {
	// 	debugger;
	}
	
	if (!state.triggerHooks[triggerId]) {
		state.triggerHooks[triggerId] = {};
	}
	if (!state.triggerHooks[triggerId][asyncId]) {
		state.triggerHooks[triggerId][asyncId] = ctx;
	// } else if (state.DEBUGING_ON) {
	// 	debugger;
	}
	
	// tid & eid
	const eid = dive.eid;
	const tid = dive.tid;
	
	if(! state.eidHooks[eid]) {
		state.eidHooks[eid] = {};
	}
	if (!state.eidHooks[eid][asyncId]) {
		state.eidHooks[eid][asyncId] = ctx;
	// } else if (state.DEBUGING_ON) {
	// 	debugger;
	}
	
	if(! state.tidHooks[tid]) {
		state.tidHooks[tid] = {};
	}
	if (!state.tidHooks[tid][asyncId]) {
		state.tidHooks[tid][asyncId] = ctx;
	// } else if (state.DEBUGING_ON) {
	// 	debugger;
	}

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
		saveHooksContext(ctx);
		
	} else {
		
		const prevId = asyncId - 1;
		
		// maybe new context born from calls
		var it = state.asyncIdHooks[prevId];
		
		// this asyncId does not exists
		if (
			!state.asyncIdHooks[asyncId] &&
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
			state.eidHooks[prevId - 2]
			&&
			state.eidHooks[prevId - 2][prevId - 1]
			&&
			state.eidHooks[prevId - 2][prevId - 1].ctx == it.ctx
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
			
		// } else if (state.DEBUGING_ON) {
		// 	debugger;
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
	
	// WOW !
	// at AsyncHook.drop (/home/went/_dev/dive/index.js:293:26)
	// at emitAfterNative (internal/async_hooks.js:163:40)
	
	// seekeing stored hooks
	const aidHook = state.asyncIdHooks[asyncId];
	
	if (aidHook) {
		state.currentContext = state.asyncIdHooks[asyncId].mix;
		const triggerId = state.asyncIdHooks[asyncId].triggerId;
		delete state.asyncIdHooks[asyncId];
		if (
			state.triggerHooks[triggerId] &&
			state.triggerHooks[triggerId][asyncId]
		) {
			delete state.triggerHooks[triggerId][asyncId];
		}
	}
	
	if (state.triggerHooks[asyncId]) {
		delete state.triggerHooks[asyncId];
	}
	
	// tid & eid
	const eid = dive.eid;
	const tid = dive.tid;
	
	if (state.eidHooks[eid] && state.eidHooks[eid][asyncId]) {
		delete state.eidHooks[eid][asyncId];
	// } else if (state.DEBUGING_ON) {
	// 	debugger;
	}
	if (state.tidHooks[tid] && state.tidHooks[tid][asyncId]) {
		delete state.tidHooks[tid][asyncId];
	// } else if (state.DEBUGING_ON) {
	// 	debugger;
	}
	
};

dive.stopTracing = () => {
	if (!state.currentContext) {
		return;
	}
	Object.keys(state.asyncIdHooks).forEach(id => {
		const hook = state.asyncIdHooks[id];
		if (hook.ctx == state.currentContext) {
			drop(id);
		}
	});
};

dive.hooks = {
	init,
	before,
	after   : drop,
	destroy : drop
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
