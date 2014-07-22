import rpc = require('./rpc');
import testLib = require('../test');

class FakePort implements rpc.MessagePort<rpc.CallMessage, rpc.ReplyMessage> {
	private handlers: {
		method: string;
		callback: (data: any) => any;
	}[];

	constructor(public receiver?: FakePort) {
		this.handlers = [];
		if (receiver) {
			this.receiver.receiver = this;
		}
	}

	on(method: string, handler: (data: any) => any) : void {
		this.handlers.push({
			method: method,
			callback: handler
		});
	}

	emit(method: string, data: Object) : void {
		this.receiver.handlers.forEach((handler) => {
			if (handler.method == method) {
				handler.callback(data);
			}
		});
	}
};

class FakeWindow implements rpc.WindowMessageInterface {
	private port: FakePort;

	constructor(public receiver?: FakeWindow) {
		if (receiver) {
			this.port = new FakePort(receiver.port);
		} else {
			this.port = new FakePort();
		}
	}

	addEventListener(event: string, handler: (ev: MessageEvent) => void) {
		this.port.on('message', (ev: MessageEvent) => {
			handler(ev);
		});
	}

	postMessage(message: any, targetOrigin: string) {
		this.port.emit('message', {
			data: message
		});
	}
};

testLib.addAsyncTest('simple rpc call and reply', (assert) => {
	var clientPort = new FakePort();
	var serverPort = new FakePort(clientPort);

	var client = new rpc.RpcHandler(clientPort);
	var server = new rpc.RpcHandler(serverPort);

	server.on('add', (a, b) => {
		return a + b;
	});

	var message = '';
	server.on('sayHello', () => {
		message = 'hello world';
	});

	client.call('add', [3, 4], (err, sum) => {
		assert.equal(sum, 7);
		testLib.continueTests();
	});
});

testLib.addAsyncTest('rpc error', (assert) => {
	var clientPort = new FakePort();
	var serverPort = new FakePort(clientPort);

	var client = new rpc.RpcHandler(clientPort);
	var server = new rpc.RpcHandler(serverPort);

	server.on('divide', (a, b) => {
		if (b === 0) {
			throw new Error('divide-by-zero');
		}
		return a/b;
	});
	client.call('divide', [4, 0], (err, result) => {
		assert.ok(err instanceof Error);
		assert.equal(err.message, 'divide-by-zero');
		testLib.continueTests();
	});
});

testLib.addAsyncTest('rpc async call and reply', (assert) => {
	var clientPort = new FakePort();
	var serverPort = new FakePort(clientPort);

	var client = new rpc.RpcHandler(clientPort);
	var server = new rpc.RpcHandler(serverPort);

	server.onAsync('add', (done, a, b) => {
		done(null, a+b);
	});

	client.call('add', [5, 6], (err, sum) => {
		assert.equal(sum, 11);
		testLib.continueTests();
	});
});

testLib.addAsyncTest('rpc async error', (assert) => {
	var clientPort = new FakePort();
	var serverPort = new FakePort(clientPort);

	var client = new rpc.RpcHandler(clientPort);
	var server = new rpc.RpcHandler(serverPort);

	// handler that passes an error to done()
	server.onAsync('divide', (done, a, b) => {
		if (b === 0) {
			done(new Error('divide-by-zero'), null);
		} else {
			done(null, a/b);
		}
	});

	// handler that throws an exception directly in onAsync()
	server.onAsync('divide2', (done, a, b) => {
		if (b === 0) {
			throw new Error('divide-by-zero');
		} else {
			done(null, a/b);
		}
	});

	client.call('divide', [5, 0], (err, result) => {
		assert.ok(err instanceof Error);
		assert.equal(err.message, 'divide-by-zero');

		client.call('divide2', [3, 0], (err, result) => {
			assert.ok(err instanceof Error);
			assert.equal(err.message, 'divide-by-zero');
			testLib.continueTests();
		});
	});
});

testLib.addAsyncTest('window.postMessage() rpc call and reply', (assert) => {
	var fakeWindowA = new FakeWindow();
	var fakeWindowB = new FakeWindow(fakeWindowA);

	var windowPortA = new rpc.WindowMessagePort(fakeWindowA, '*');
	var windowPortB = new rpc.WindowMessagePort(fakeWindowB, '*');

	var client = new rpc.RpcHandler(windowPortA);
	var server = new rpc.RpcHandler(windowPortB);

	server.on('add', (a, b) => {
		return a + b;
	});
	client.call('add', [3, 4], (err, sum) => {
		assert.equal(sum, 7);
		testLib.continueTests();
	});
});

testLib.start();