if (!this.browser) {
	this["importScripts"]("/dist/action-api.js");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	switch (message.type) {
	case "invocation": {
		const action = getApiAction(message.key);
		if (action && action.params && !Object.keys(action.params).every(param => message.args[param])) {
			sendResponse({
				context: {
					paramInfo: Object.entries(action.params).find(([ param ]) => !message.args[param]),
				},
			});
			return;
		}
		call(message.key, message.args, message.command);
		sendResponse({});
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
