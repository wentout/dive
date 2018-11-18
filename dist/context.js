// 'use strict';

const { performance } = require('perf_hooks');
const { AsyncResource } = require('async_hooks');

const errors = require('./errors');
const hooks = require('./hooks');

/**
 * variable to store our current context
 * when syncronous code is runnign
 * for ability to give it by request
 */
const ID = {
	current: null,
	last: null
};

// cause we can have
// multiplie "dive"s
// running simultaniously
const runningContexts = new Map();
const runningContextsValues = new Map();

const lastUnsetValue = () => {
	const props = runningContexts.get(ID.last);
	return props ? props.value : undefined;
};

/**
 * about to change currentContext
 * just an abstraction layer
 * @param {any} value 
 */
const changeContext = (value) => {
	if (!runningContexts.has(ID.current)) {
		return;
	}
	const props = runningContexts.get(ID.current);
	runningContextsValues.delete(props);
	runningContextsValues.set(props, value);
	return runningContexts.get(ID.current).value;
};

Object.defineProperty(module.exports, 'self', {
	get() {
		return (id = ID.current) => {
			return runningContexts.get(id);
		};
	}
});

Object.defineProperty(module.exports, 'hasId', {
	get() {
		return id => {
			return runningContexts.has(id);
		};
	}
});

const valueDescriptor = {
	get() {
		if (runningContexts.has(ID.current)) {
			return runningContexts.get(ID.current).value;
		} else {
			const errorStack = (new Error()).stack;
			if (errorStack.includes('emitPromiseRejectionWarnings')) {
				const value = lastUnsetValue();
				return value;
			}
		}
		return undefined;
	},
	set(value) {
		return changeContext(value);
	},
	configurable: false,
	enumerable: true
};

Object.defineProperty(module.exports, 'valueDescriptor', {
	get() {
		return valueDescriptor;
	},
});
Object.defineProperty(module.exports, 'value', valueDescriptor);
Object.defineProperty(module.exports, 'currentContextValue', valueDescriptor);


const currentContextStack = () => {
	if (runningContexts.has(ID.current)) {
		return runningContexts.get(ID.current).stack;
	}
	return undefined;
};
Object.defineProperty(module.exports, 'currentContextStack', {
	get() {
		return currentContextStack();
	},
	enumerable: true
});
Object.defineProperty(module.exports, 'adjustErrorStack', {
	get() {
		return (error) => {
			const stack = error ? error.stack : '';
			const diveStack = currentContextStack();
			if (diveStack) {
				return `${stack}${diveStack}`;
			}
			return error.stack;
		};
	},
	enumerable: true
});

Object.defineProperty(module.exports, 'valueById', {
	get() {
		return (idForValue) => {
			if (runningContexts.has(idForValue)) {
				return runningContexts.get(idForValue).value;
			}
			return undefined;
		};
	},
	enumerable: true
});

Object.defineProperty(module.exports, 'optsById', {
	get() {
		return (idForValue) => {
			if (runningContexts.has(idForValue)) {
				return runningContexts.get(idForValue).opts;
			}
			return undefined;
		};
	},
	enumerable: true
});
Object.defineProperty(module.exports, 'currentOpts', {
	get() {
		if (runningContexts.has(ID.current)) {
			return runningContexts.get(ID.current).opts;
		}
		return undefined;
	},
	enumerable: true
});
Object.defineProperty(module.exports, 'basePassed', {
	get() {
		if (runningContexts.has(ID.current)) {
			return runningContexts.get(ID.current).basePassed;
		}
		return undefined;
	},
	set() {
		if (runningContexts.has(ID.current)) {
			return runningContexts.get(ID.current).basePassed = true;
		}
		return undefined;
	},
	enumerable: true
});

Object.defineProperty(module.exports, 'counters', {
	get() {
		return (idForValue = ID.current) => {
			if (runningContexts.has(idForValue)) {
				return runningContexts.get(idForValue).counters;
			}
			return undefined;
		};
	},
	enumerable: true
});

const measureById = (idForValue) => {
	const it = runningContexts.get(idForValue);
	if (!it) {
		return new Error('this context does not exists');
	}
	return performance.now() - it.startTime;
};

Object.defineProperty(module.exports, 'measureById', {
	get() {
		return measureById;
	},
	enumerable: true
});
Object.defineProperty(module.exports, 'measure', {
	get() {
		if (!runningContexts.has(ID.current)) {
			return new Error('out of context');
		}
		return measureById(ID.current);
	},
	enumerable: true
});

const idPropDescriptor = {
	get() {
		if (runningContexts.has(ID.current)) {
			return ID.current;
		}
		return null;
	},
	configurable: false,
};
Object.defineProperty(module.exports, 'id', idPropDescriptor);
Object.defineProperty(module.exports, 'currentId', idPropDescriptor);


const lastIDPropDescriptor = {
	get() {
		return runningContexts.has(ID.last) ? ID.last : null;
	},
	configurable: false,
	enumerable: true
};
Object.defineProperty(module.exports, 'lastId', lastIDPropDescriptor);
Object.defineProperty(module.exports, 'lastUnsetId', lastIDPropDescriptor);
Object.defineProperty(module.exports, 'lastUnsetValue', {
	get() {
		return lastUnsetValue();
	},
	enumerable: true
});

Object.defineProperty(module.exports, 'runningContextsIDs', {
	get() {
		return runningContexts.keys();
	},
	enumerable: true
});

Object.defineProperty(module.exports, 'runningContextsCount', {
	get() {
		return runningContexts.size;
	},
	enumerable: true
});

const values = {
	get() {
		return new Set(runningContextsValues.values());
	},
	configurable: false,
	enumerable: true
};

Object.defineProperty(module.exports, 'values', values);
Object.defineProperty(module.exports, 'runningContextsValues', values);

const getStack = () => {
	const stack = (new Error()).stack
		.split('\n')
		.slice(5);
	stack.unshift('\n    <------- from ------->');
	return stack.join('\n');
};

var currentCreationContextId = null;
Object.defineProperty(module.exports, 'currentCreationContextId', {
	get() {
		return currentCreationContextId;
	}
});
Object.defineProperty(module.exports, 'create', {
	get() {
		return (value, fn, opts) => {

			if (typeof options == 'function') {
				fn = opts;
				opts = {};
			}

			var basePassed = false;

			// const contextId = `${performance.now()}`;
			const contextId = performance.now();

			const eid = hooks.eid;
			const tid = hooks.tid;

			const props = {
				fn,
				opts,
				// ... MEANINGFULL NOTE ...
				// looking on eid through debugger 
				// we can see 0 instead of 1 here
				// if we are passing 1st scope
				// seems something from C code
				// and looks like not a bug
				// but just memory pointer 
				// changed externally from core
				eid,
				tid,
				stack: getStack(),
				counters: {
					init: 0,
					before: 0,
					after: 0,
					destroy: 0
				},
				startTime: null,
				id: contextId,
			};

			runningContexts.set(contextId, props);
			runningContextsValues.set(props, value);

			currentCreationContextId = 0 + contextId;
			const asyncResource = new AsyncResource('DIVE_ASYNC_RESOURCE', {
				requireManualDestroy: false
			});
			props.asyncResource = asyncResource;
			currentCreationContextId = null;

			if (opts.debugMode) {
				process._rawDebug('\n\n Context Started:', {
					id: contextId,
					eid: props.eid,
					tid: props.tid,
					value,
				});
			}


			// position inside contexts & values
			if (runningContexts.size !== runningContextsValues.size) {
				throw errors.ContextCorrupted();
			}

			Object.defineProperty(props, 'value', {
				get() {
					return runningContextsValues.get(props);
				},
				enumerable: true
			});

			Object.defineProperty(props, 'basePassed', {
				get() {
					return basePassed;
				},
				set() {
					basePassed = true;
					props.startTime = performance.now();
				},
				enumerable: true
			});

			return contextId;
		};
	},
	configurable: false,
	enumerable: false
});

Object.defineProperty(module.exports, 'select', {
	get() {
		return function (id) {
			ID.last = runningContexts.has(ID.current) ? ID.current : null;
			if (!runningContexts.has(id)) {
				return;
			}
			ID.current = id;
			return runningContexts.get(ID.current).value;
		};
	},
	enumerable: true
});


const unset = () => {
	ID.last = runningContexts.get(ID.current) ? ID.current : null;
	ID.current = null;
};

Object.defineProperty(module.exports, 'unset', {
	get() {
		return unset;
	},
	enumerable: true
});


const destroy = (id = ID.current) => {
	if (!runningContexts.has(id)) {
		throw errors.ContextDoesNotExists(`context ID : ${id}`);
	}

	const destroyedProps = runningContexts.get(id);
	const destroyedValue = destroyedProps.value;

	unset();

	// we are unable to get rid of runningContexts[id]
	// by using some sort of runningContexts.splice(id, 1);
	// cause we will change the position number for other [dive]'s
	// so we just replace it with undefined value
	runningContexts.delete(id);
	runningContextsValues.delete(destroyedProps);

	return destroyedValue;
};

Object.defineProperty(module.exports, 'destroy', {
	get() {
		return destroy;
	},
	enumerable: true
});

Object.defineProperty(module.exports, 'hooksEnabled', {
	get() {
		return hooks.enabled;
	},
	enumerable: true
});


