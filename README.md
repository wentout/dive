# context-dive

**dive to async callbacks with context**

This module allows you to wrap all nested callbacks of function with some context. It returns wrapped function, which then you are able to call the same, as it was call for non wrapped function. Then, inside of the mess of async code, which runs from your wrapped function you will be able to retrive that context. It based on async_hooks node.js core module, so it only works with node versions above 8.

However, by default all async_hooks functionality is disabled, cause it reduce perfomance. Also it memorize everything about running wrapped execution thread, and it needs a lot of memory to do this. But, there is a way to cleanup everything about wrapped context when you don't need this thread anymore.

There are also some syntax sugar placed, so you are able to stay on top of this bunch.

```
npm i context-dive
```

**Short £xampl€**

```JS
const dive = require('context-dive');

const d = (cb) => {
    return (t, y) => {
        console.log(t, y);
        setTimeout(() => {
            cb('asdf', 'fdsa');
        }, 100);
    };
};

const z = (cb) => {
    console.log('currentContext', dive.currentContext);
    setTimeout(() => {
        cb('zxcv', 'vcxz');
    }, 1000);
};

const m = dive(d, 'qwer')(function (a, b) {
    console.log(dive.currentContext, a, b);
});

const s = dive(z, 'lkjh');

s(m);

```


will output


```
currentContext lkjh
zxcv vcxz
qwer asdf fdsa
```


For more details run:
```
node example.js
```


# API

the stuff you will get from pointer to dive

```JS
const dive = require('context-dive');
```

## dive.currentContext || dive.ctx
Pointer to current context if execution thread is wrapped.

## dive.enableAsyncHooks()
You need to switch async hooks trace to wrap any async
You need to make this before you will make any wrapping.
This is a global change, all your wrapped context will become async wrapped after, the way to switch this on for one context and do not switch for another is not yet implemented in this library. If you really need this -- make an Issue.

## dive.disableAsyncHooks()
About to disable previously enabled async hooks trhead wrappings.

## dive.stopTracing() || dive.clean()
Stop tracing of current dive.currentContext and rid of any pointers to it in memory. You need to run this code when you don't need current context anymore. Especially you need try to run it inside of your:

```JS
process.on('uncaughtException' ...
process.on('unhandledRejection' ...
```
to escape other unpredictable consequences.


## dive.put
Put something instead of dive.currentContext. Can be usefull if you need to change it when thread is already running. However, I didn't made test of this feature, but I suppose all pointers of dive.currentContext will be replaced. Or may be not. Make an issue if you really need it.

## dive.enableFunctions()
Enable Function.prototype.dive patch, so you can do the following:

```JS
const dive = require('context-dive');

const myFn = () => {
	console.log(dive.currentContext);
};
// 
const diveFn = myFn.dive('my context');
diveFn();
```

## dive.disableFunctions()
Disable Function.prototype.dive patch.

## dive.useGlobal()
About to place pointer to dive.currentContext to global.

## dive.state
Pointer to everything about dive state mashine. Most of this stuff is availiable by other **dive.[shortcut]**. But, for sure it will give you much more control about how everything works.

### dive.state.currentContext || dive.state.ctx
The same as **dive.currentContext** || **dive.ctx**.

### dive.state.asyncIdHooks
Current hash of asyncIDs that called dive.hooks.init with all nested props.

### dive.state.triggerHooks
Current hash of asyncIDs that triggered dive.hooks.init call with all nested props.

### dive.state.eidHooks
Current hash of asyncIDs that was running while dive.hooks.init call with all nested props.

### dive.state.tidHooks
Current hash of asyncIDs that triggered eidHooks while dive.hooks.init call with all nested props.

### dive.state.baseRunning
If wrapped function itself, or tied~neste callback of this function is running now.

### dive.state.hookRunning
This mutch state between async_hook.before and async_hook.after, cause it synchrounous code. So, if you have some context seems hook is running or base is running.

### dive.state.eidsEnabled
The same as **dive.eidsEnabled** below.

## dive.disableExperimental()
If you wish to disable experimental context matching/wrapping. See more at **state.experimentalEnabled**.

## dive.enableExperimental()
Experimental context matching/wrapping is enabled by default. No needs to run this method while instantiating dive in your code. Only may be necessary if you did dive.disableExperimental() before.

## dive.enableEIDs() -- ! only for Development !
When async hooks enabled there can be situation when context of executin thread will becom empty. This is not a very common situation, I think you will never get it, actually. But, may be if you will get, then this function will help you. It will switch the functionality of seeking context through executinID, if it can't be found via asyncId.

## dive.disableEIDs() -- ! only for Development !
Disable enabled eids context search functionality.

## dive.eidsEnabled -- ! only for Development !
Pointer to retrive if eids context search functionality is enabled or disabled.

## dive.asyncIdHooks
Hash of all known async hook IDs, traced by dive right now.

## dive.triggerHooks
Hash of all known async hook IDs, that triggered contexts of dive.asyncIdHooks.

## dive.eidHooks
Hash of all known async hook execution IDs, that was running when asyncId was placed to dive.asyncIdHooks.

## dive.tidHooks
Hash of all known async hook execution IDs of triggers that called that execution IDs, that was running when asyncId was placed to dive.asyncIdHooks.

## dive.hooks
Hash of our async_hooks callbacks. May be you will need to replace them by yours, who knows.

## dive.asyncHook
Available only after dive.enableAsyncHooks();
Pointer to async hook used by dive, read more in node.js documentation.

```JS
dive.asyncHook = require('async_hooks').createHook(dive.hooks);
```

## dive.async_hooks
Available only after dive.enableAsyncHooks();

```JS
dive.async_hooks = require('async_hooks');
```

## dive.eid
Current async_hooks execution id.

## dive.tid
Current async_hooks id that triggered current execution id.

