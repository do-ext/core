type APIAction = {
	name: string
	nameShort?: string
	actions: Record<string, APIAction>
	params?: Record<string, string>
	call?: (args: Record<string, string>) => Promise<void>
}

type APIQuery = {
	name: string
	nameShort: string
	actions: Record<string, APIQuery>
	isInvocable?: boolean
}

const getTabsInWindow = () =>
	chrome.tabs.query({ lastFocusedWindow: true })
;

const getTabIndex = (index: number, shift: number, tabCount: number) =>
	shift >= 0
		? (index + shift) % tabCount
		: (tabCount - 1) + ((index - (tabCount - 1) + shift) % tabCount)
;

const api: APIAction = {
	name: "manage the browser",
	actions: {
		tabs: {
			name: "manage tabs",
			actions: {
				create: {
					name: "create tab",
					nameShort: "new tab",
					actions: {},
					call: async () => {
						await chrome.tabs.create({});
					},
				},
				highlight: {
					name: "highlight tabs",
					actions: {
						shift: {
							name: "highlight a relative tab",
							nameShort: "highlight tab",
							actions: {},
							params: { shift: "number" },
							call: async args => {
								const tabs = await getTabsInWindow();
								const tabSelected = tabs.find(tab => !tab.active && tab.highlighted);
								const tabActiveIndex = tabs.findIndex(tab => tab.active);
								const tabIndex = getTabIndex(tabActiveIndex, parseInt(args.shift), tabs.length);
								if (this.browser) {
									const highlighting = chrome.tabs.update(tabs[tabIndex].id as number, { highlighted: true, active: false });
									if (tabSelected) {
										await chrome.tabs.update(tabSelected.id as number, { highlighted: false });
									}
									await highlighting;
								} else {
									const operations: Array<Promise<unknown>> = [];
									operations.push(chrome.tabGroups.query({ title: "doExt" }).then(groups => {
										groups.forEach(async ({ id: groupId }) => {
											operations.push(chrome.tabs.ungroup(
												(await chrome.tabs.query({ groupId })).map(tab => tab.id as number)
											));
										});
									}));
									await chrome.tabs.group({ tabIds: tabs[tabIndex].id as number }).then(async value => {
										operations.push(chrome.tabGroups.update(value, {
											title: "doExt",
											color: "blue",
										}));
									});
									for (const operation of operations) {
										await operation;
									}
								}
							},
						},
					},
				},
				activate: {
					name: "activate tabs",
					actions: {
						shift: {
							name: "activate a relative tab",
							nameShort: "go to tab",
							actions: {},
							params: { shift: "number" },
							call: async args => {
								const tabs = await getTabsInWindow();
								const tabActiveIndex = tabs.findIndex(tab => tab.active);
								const tabIndex = getTabIndex(tabActiveIndex, parseInt(args.shift), tabs.length);
								await chrome.tabs.update(tabs[tabIndex].id as number, { active: true });
							},
						},
						highlighted: {
							name: "activate highlighted tab",
							actions: {},
							call: async () => {
								const tab = (await chrome.tabs.query(this.browser
									? { highlighted: true, active: false }
									: { groupId: (await chrome.tabGroups.query({ title: "doExt" }))[0].id }
								))[0];
								const activating = chrome.tabs.update(tab.id as number, { active: true });
								if (!this.browser) {
									await chrome.tabs.ungroup(tab.id as number);
								}
								await activating;
							},
						},
					},
				},
			},
		},
		windows: {
			name: "manage windows",
			actions: {
				create: {
					name: "create window",
					nameShort: "new window",
					actions: {},
					call: async () => {
						await chrome.windows.create();
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const call = (key: string, args: Record<string, string>) => {
	const apiAction = getApiAction(key);
	if (!apiAction || !apiAction.call) {
		console.warn(`API Action not found for key ${key}.`);
		return;
	}
	apiAction.call(args);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const query = (apiAction: APIAction = api, apiQuery: APIQuery = {
	name: api.name,
	nameShort: api.nameShort ?? api.name,
	actions: {},
	isInvocable: false,
}): APIQuery => {
	Object.entries(apiAction.actions).forEach(([ key, action ]) => {
		apiQuery.actions[key] = {
			name: action.name,
			nameShort: action.nameShort ?? action.name,
			actions: {},
			isInvocable: !!action.call,
		};
		query(action, apiQuery.actions[key]);
	});
	return apiQuery;
};
