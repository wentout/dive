# dive
dive to callback with context

```
npm i context-dive
```

**£xampl€**

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

const m = dive.call(d, 'qwer')(function (a, b) {
	console.log(_currentContext, a, b);
});

const s = dive.call(z, 'lkjh');

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
