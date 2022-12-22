type APIAction = {
	call?: (command: string, ...args: Array<string>) => Promise<void>
	actions: Record<string, APIAction>
}

type APIQuery = {
	isInvocable?: boolean
	actions: Record<string, APIQuery>
}

const getTabsInWindow = () =>
	chrome.tabs.query({ lastFocusedWindow: true })
;

const evaluateExpression = (expressionString: string, commandLength: number): number => {
	const expression = expressionString.split(" ").map(node =>
		node === "<length>"
			? commandLength
			: [ "+", "-" ].includes(node) ? node : parseInt(node)
	);
	let result = 0;
	let mode = "+";
	expression.forEach(node => {
		if (typeof node === "string") {
			mode = node;
		} else {
			switch (mode) {
			case "+": {
				result += node;
				break;
			} case "-": {
				result -= node;
				break;
			}}
		}
	});
	return result;
};

const getTabIndex = (index: number, shift: number, tabCount: number) =>
	shift >= 0
		? (index + shift) % tabCount
		: (tabCount - 1) + ((index - (tabCount - 1) + shift) % tabCount)
;

const api: APIAction = {
	actions: {
		tabs: {
			actions: {
				highlight: {
					actions: {
						shift: {
							call: async (command, shift) => {
								const tabs = await getTabsInWindow();
								const tabSelected = tabs.find(tab => !tab.active && tab.highlighted);
								const tabActiveIndex = tabs.findIndex(tab => tab.active);
								const tabIndex = getTabIndex(tabActiveIndex, evaluateExpression(shift, command.length), tabs.length);
								if (this.browser) {
									chrome.tabs.update(tabs[tabIndex].id as number, { highlighted: true, active: false });
									if (tabSelected) {
										chrome.tabs.update(tabSelected.id as number, { highlighted: false });
									}
								} else {
									chrome.tabGroups.query({ title: "doExt" }).then(groups => {
										groups.forEach(async ({ id: groupId }) => {
											chrome.tabs.ungroup((await chrome.tabs.query({ groupId })).map(tab => tab.id as number));
										});
									});
									chrome.tabs.group({ tabIds: tabs[tabIndex].id as number }).then(async value => {
										chrome.tabGroups.update(value, {
											title: "doExt",
											color: "blue",
										});
									});
								}
							},
							actions: {},
						},
					},
				},
				activate: {
					actions: {
						shift: {
							call: async (command, shift) => {
								const tabs = await getTabsInWindow();
								const tabActiveIndex = tabs.findIndex(tab => tab.active);
								const tabIndex = getTabIndex(tabActiveIndex, evaluateExpression(shift, command.length), tabs.length);
								chrome.tabs.update(tabs[tabIndex].id as number, { active: true });
							},
							actions: {},
						},
						highlighted: {
							call: async () => {
								const tab = (await chrome.tabs.query(this.browser
									? { highlighted: true, active: false }
									: { groupId: (await chrome.tabGroups.query({ title: "doExt" }))[0].id }
								))[0];
								chrome.tabs.update(tab.id as number, { active: true });
								if (!this.browser) {
									chrome.tabs.ungroup(tab.id as number);
								}
							},
							actions: {},
						},
					},
				},
			},
		},
	},
};

const getKeyHead = (key: string) =>
	key.split(".")[0]
;

const getKeyTail = (key: string) =>
	key.split(".").slice(1).join(".")
;

const getApiAction = (key: string, apiAction: APIAction = api): APIAction | undefined =>
	key.includes(".")
		? getApiAction(getKeyTail(key), apiAction.actions[getKeyHead(key)])
		: apiAction.actions[key]
;

const call = (key: string, command: string, ...args: Array<string>) => {
	const apiAction = getApiAction(key);
	if (!apiAction || !apiAction.call) {
		console.warn(command, apiAction);
		return;
	}
	apiAction.call(command, ...args);
};

const query = (apiAction: APIAction = api, apiQuery: APIQuery = {
	isInvocable: false,
	actions: {},
}): APIQuery => {
	Object.entries(apiAction.actions).forEach(([ key, action ]) => {
		apiQuery.actions[key] = {
			isInvocable: !!action.call,
			actions: {},
		};
		query(action, apiQuery.actions[key]);
	});
	return apiQuery;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	switch (message.type) {
	case "invocation": {
		call(message.key, message.command, message.args);
		break;
	} case "query": {
		sendResponse(query());
		break;
	}}
});
