# context-dive 2

**Dive to async code with Context**

## V 1.1.8 Post Mortem

Inspite that V 2 utilise the Core Concept of v 1.1.8, the way old version was made is odd. I rid of all that old code with complete new bundle. The API is about 50% the same, and concept is 100% the same. You can find old documentation *here*

## V 2 Documentation

This module allows you to wrap some execution context context via **[async_hooks](https://nodejs.org/api/async_hooks.html)**. The main Idea is the wrapped **execution context** must be a function, cause otherwise we will be unable to handle everything. Core concept is about that if that function attributes has some incoming callbacks, we will be able to track the context back through that callbacks too.

Using this module you are able to acheive the following functionality:

1. CLS~TLS : Continuation~Thread Local Storage ([wikipedia link](https://en.wikipedia.org/wiki/Thread-local_storage)).
2. Perfomance measuring, based on the top of **Dived Context** we are runningn in
3. Meaningfull UncaughtException and UnhandledRejection extras, based on CLS.

... also there is plan to develop bit more rich functionality ...


### Installation is Simple

```
npm i context-dive
```

### Promise Note
Unfortunately there is no way to dive CLS inside of UnhandledRejection, so untill this moment the API for that is bit tricky, however, at least it definetely Works (instead of 1.1.8).

# API

### Work for full Description is In Progress ###

the stuff you will get from pointer to dive

```JS
const dive = require('context-dive');

const fn = (cb) => {
	setTimeout ...
	nextTick...
	Promise
		cb
};

dive(fn, 'MyContext')(() => {
	// here we passed a lot of
	const LinkToContext = dive.ctx // MyContext
	// and you are able to fill it
	// through all that nested fn code and so far
});




