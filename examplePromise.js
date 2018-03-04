// This part of code
// is grabbed from
// https://github.com/mvaldesdeleon/long-promise/blob/master/example.js
// Great Thanks to Martín Valdés de León


const dive = require('./index.js');
dive.enableAsyncHooks();
dive.enableFunctions();


// Simulate some stuff
const stuff = x => 2 + x;

// Simulate a delay.
const delay = ms => x => {
	// This function is `buggy` and will throw if the delay is 100ms.
	if (ms === 100) throw new Error('boom');

	return new Promise(res => {
		setTimeout(() => {
			res(x);
		}, ms);
	});
};

const nestedProblems = x => () => {
	// After the third call, go to an eventual `delay(100)` that throws
	if (x === 3) return Promise.resolve(1).then(delay(100));

	// Promise chain with recursion
	return Promise.resolve(1)
		.then(delay(10))
		.then(stuff)
		.then(nestedProblems(x + 1));
};

// Main program
function run() {
	const p = Promise.resolve(2);

	// Do some things. Something along this promise chain will throw.
	p.then(stuff)
		.then(delay(10))
		.then(stuff)
		.then(delay(10))
		.then(stuff)
		.then(nestedProblems(1))
		.then(stuff)
		.then(stuff)
		.catch(() => {
			// Profit
			process.stdout.write('>>>', dive.currentContext);
		});
}

run.dive('we have context')();
run._dive('we have context')();