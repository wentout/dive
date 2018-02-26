'use strict';

const dive = function (context, ctx) {
	const fn = this;
	const base = function () {
		const run = fn.bind(ctx || this);
		const args = [...arguments].map(arg => {
			if (typeof arg == 'function') {
				arg = dive.call(arg, context);
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
		return answer;
	};
	base._currentContext = context;
	return base;
};

const objectMethodDive = (obj, prop, context) => {
	return dive.call(obj[prop], context, obj);
};

objectMethodDive.enable = () => {
	Function.prototype.dive = dive;
};
objectMethodDive.disable = () => {
	delete Function.prototype.dive;
};

module.exports = objectMethodDive;
