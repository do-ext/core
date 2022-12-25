if (!this.browser) {
	this["importScripts"]("/dist/action-api.js");
}

const sendInvocationResponse = async message =>
	chrome.runtime.sendMessage({
		type: "response",
		argumentRequests: await call(message.key, message.args),
	})
;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	switch (message.type) {
	case "invocation": {
		sendInvocationResponse(message);
		break;
	} case "query": {
		sendResponse(query());
		break;
	}}
});

chrome.commands.onCommand.addListener(command => {
	if (command === "open-popup") {
		chrome.action["openPopup"]();
	}
});
