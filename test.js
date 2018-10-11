const dive = require('./src/index');

const queueArray = [];

setInterval(() => {
	queueArray.forEach(task => {
		task();
	});
}, 1000);

const fn2wrap = () => {
	// Here we will have dive context
	console.log(' w  context : ', dive.ctx); // 'some context'
	// And now we create function
	// And push it to queue
	// queueArray.push(dive.hopAutoWrap(() => {
	queueArray.push(() => {
		// that function will not be able to get any context
		console.log(' no context : ', dive.ctx); // undefined
	});
};

dive(fn2wrap, 'some context')();
