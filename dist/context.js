'use strict';

const { performance } = require('perf_hooks');

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
const runningContexts = [];
const runningContextsValues = [];

const lastUnsetValue = () => {
	const context = runningContexts[ID.last];
	return context ? context.value : undefined;
};

/**
 * about to change currentContext
 * just an abstraction layer
 * @param {any} value 
 */
const changeContext = (value) => {
	if (!Number.isInteger(ID.current)) {
		return;
	}
	runningContexts[ID.current].value = value;
	return value;
};

Object.defineProperty(module.exports, 'self', {
	get() {
		return (id = ID.current) => {
			return runningContexts[id];
		};
	},
	configurable: false,
	enumerable: false
});

const valueDescriptor = {
	get() {
		if (runningContexts[ID.current]) {
			return runningContexts[ID.current].value;
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
	configurable: false,
	enumerable: false
});
Object.defineProperty(module.exports, 'value', valueDescriptor);
Object.defineProperty(module.exports, 'currentContextValue', valueDescriptor);


const currentContextStack = () => {
	if (runningContexts[ID.current]) {
		return runningContexts[ID.current].stack;
	}
	return undefined;
};
Object.defineProperty(module.exports, 'currentContextStack', {
	get() {
		return currentContextStack();
	},
	configurable: false,
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
	configurable: false,
	enumerable: true
});

Object.defineProperty(module.exports, 'valueById', {
	get() {
		return (idForValue) => {
			if (runningContexts[idForValue]) {
				return runningContexts[idForValue].value;
			}
			return undefined;
		};
	},
	configurable: false,
	enumerable: true
});

Object.defineProperty(module.exports, 'optsById', {
	get() {
		return (idForValue) => {
			if (runningContexts[idForValue]) {
				return runningContexts[idForValue].opts;
			}
			return undefined;
		};
	},
	configurable: false,
	enumerable: true
});
Object.defineProperty(module.exports, 'currentOpts', {
	get() {
		if (runningContexts[ID.current]) {
			return runningContexts[ID.current].opts;
		}
		return undefined;
	},
	configurable: false,
	enumerable: true
});
Object.defineProperty(module.exports, 'basePassed', {
	get() {
		if (runningContexts[ID.current]) {
			return runningContexts[ID.current].basePassed;
		}
		return undefined;
	},
	set() {
		if (runningContexts[ID.current]) {
			return runningContexts[ID.current].basePassed = true;
		}
		return undefined;
	},
	configurable: false,
	enumerable: true
});

Object.defineProperty(module.exports, 'counters', {
	get() {
		return (idForValue = ID.current) => {
			if (runningContexts[idForValue]) {
				return runningContexts[idForValue].counters;
			}
			return undefined;
		};
	},
	configurable: false,
	enumerable: true
});

const measureById = (idForValue) => {
	const it = runningContexts[idForValue];
	if (!it) {
		return new Error('this context does not exists');
	}

	return performance.now() - it.startTime;
};

Object.defineProperty(module.exports, 'measureById', {
	get() {
		return measureById;
	},
	configurable: false,
	enumerable: true
});
Object.defineProperty(module.exports, 'measure', {
	get() {
		if (!runningContexts[ID.current]) {
			return new Error('out of context');
		}
		return measureById(ID.current);
	},
	configurable: false,
	enumerable: true
});

const idPropDescriptor = {
	get() {
		if (runningContexts[ID.current]) {
			return ID.current;
		}
		return null;
	},
	configurable: false,
	enumerable: true
};
Object.defineProperty(module.exports, 'id', idPropDescriptor);
Object.defineProperty(module.exports, 'currentId', idPropDescriptor);


const lastIDPropDescriptor = {
	get() {
		const lastId = ID.last;
		return Number.isInteger(lastId) ? lastId : null;
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
	configurable: false,
	enumerable: true
});

Object.defineProperty(module.exports, 'runningContextsNumbers', {
	get() {
		return Object.keys(runningContexts).map(n => parseInt(n));
	},
	configurable: false,
	enumerable: true
});

Object.defineProperty(module.exports, 'runningContextsCount', {
	get() {
		return runningContexts.length;
	},
	configurable: false,
	enumerable: true
});

const values = {
	get() {
		return runningContextsValues.slice();
	},
	configurable: false,
	enumerable: true
};

Object.defineProperty(module.exports, 'values', values);
Object.defineProperty(module.exports, 'runningContextsValues', values);

const getStack = () => {
	const stack = (new Error()).stack
		.split('\n')
		.slice(4);
	stack.unshift('\n    <------- from ------->');
	return stack.join('\n');
};

Object.defineProperty(module.exports, 'create', {
	get() {
		return (value, fn, opts) => {

			if (typeof options == 'function') {
				fn = opts;
				opts = {};
			}

			var basePassed = false;

			// position inside contexts & values
			const valuePosition = runningContextsValues.push(value) - 1;

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
				eid: hooks.eid,
				tid: hooks.tid,
				pos: valuePosition,
				stack: getStack(),
				counters: {
					init: 0,
					before: 0,
					after: 0,
					destroy: 0
				},
				startTime: null
			};

			if (opts.debugMode) {
				process._rawDebug('\n\n Context Started:', {
					pos: valuePosition,
					value,
				});
			}

			const contextPosition = runningContexts.push(props) - 1;
			if (contextPosition !== valuePosition) {
				throw errors.ContextCorrupted();
			}

			Object.defineProperty(props, 'value', {
				get() {
					const pos = runningContexts[contextPosition].pos;
					return runningContextsValues[pos];
				},
				configurable: false,
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
				configurable: false,
				enumerable: true
			});

			return contextPosition;
		};
	},
	configurable: false,
	enumerable: false
});

Object.defineProperty(module.exports, 'select', {
	get() {
		return function (id) {
			ID.last = ID.current ? 0 + ID.current : 0;
			if (!runningContexts[id]) {
				return;
			}
			ID.current = 0 + id;
			return runningContexts[ID.current].value;
		};
	},
	configurable: false,
	enumerable: true
});


const unset = () => {
	ID.last = ID.current ? 0 + ID.current : null;
	ID.current = null;
};

Object.defineProperty(module.exports, 'unset', {
	get() {
		return unset;
	},
	configurable: false,
	enumerable: true
});


const destroy = (id = ID.current) => {
	if (!Number.isInteger(id)) {
		throw errors.NoContextAvail();
	}
	if (!runningContexts[id]) {
		throw errors.ContextDoesNotExists(`context ID : ${id}`);
	}

	const lastContextValue = runningContexts[id].value;

	unset();

	// we are unable to get rid of runningContexts[id]
	// by using some sort of runningContexts.splice(id, 1);
	// cause we will change the position number for other [dive]'s
	// so we just replace it with undefined value
	runningContexts[id] = undefined;
	runningContextsValues[id] = undefined;
	
	return lastContextValue;
};

Object.defineProperty(module.exports, 'destroy', {
	get() {
		return destroy;
	},
	configurable: false,
	enumerable: true
});
