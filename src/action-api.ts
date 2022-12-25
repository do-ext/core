type APIAction = {
	name: string
	nameShort?: string
	params?: Array<APIParameter>
	call?: (args: Record<string, string>) => Promise<void>
	actions: Record<string, APIAction>
}

type APIQuery = {
	name: string
	nameShort: string
	isInvocable?: boolean
	actions: Record<string, APIQuery>
}

type APIParameter = {
	name: string
	getArgRequestInfo: () => Promise<APIArgumentRequestInfo>
}

type APIArgument = {
	id: string
	name: string
}

type APIArgumentRequest = {
	param: string
	info: APIArgumentRequestInfo
}

type APIArgumentRequestInfo = {
	type?: APIArgumentType
	allowCustomInput?: true
	range?: [ number, number ]
	presets?: Array<APIArgument>
}

type APIArgumentType = "string" | "number"

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
					call: async () => {
						await chrome.tabs.create({});
					},
					actions: {},
				},
				highlight: {
					name: "highlight tabs",
					actions: {
						shift: {
							name: "highlight a relative tab",
							nameShort: "highlight tab",
							params: [
								{ name: "shift", getArgRequestInfo: async () => ({
									type: "number",
									allowCustomInput: true,
								}) },
							],
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
							actions: {},
						},
					},
				},
				activate: {
					name: "activate a tab",
					actions: {
						id: {
							name: "activate any tab",
							nameShort: "go to tab",
							params: [
								{ name: "tab", getArgRequestInfo: async () => ({
									presets: (await chrome.tabs.query({})).map(tab => ({
										id: (tab.id ?? -1).toString(),
										name: tab.title ?? "",
									})),
								}) },
							],
							call: async args => {
								await chrome.tabs.update(parseInt(args.tab), { active: true });
							},
							actions: {},
						},
						shift: {
							name: "activate a relative tab",
							nameShort: "shift tab",
							params: [
								{ name: "shift", getArgRequestInfo: async () => ({
									type: "number",
									allowCustomInput: true,
								}) },
							],
							call: async args => {
								const tabs = await getTabsInWindow();
								const tabActiveIndex = tabs.findIndex(tab => tab.active);
								const tabIndex = getTabIndex(tabActiveIndex, parseInt(args.shift), tabs.length);
								await chrome.tabs.update(tabs[tabIndex].id as number, { active: true });
							},
							actions: {},
						},
						highlighted: {
							name: "activate highlighted tab",
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
							actions: {},
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
					call: async () => {
						await chrome.windows.create();
					},
					actions: {},
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
const call = async (key: string, args: Record<string, string>): Promise<Array<APIArgumentRequest>> => {
	const action = getApiAction(key);
	if (!action || !action.call) {
		console.warn(`API Action not found for key ${key}.`);
		return [];
	}
	const paramsUnsatisfied = (action.params ?? []).filter(param => !args[param.name]);
	if (paramsUnsatisfied.length) {
		const argumentRequests: Array<APIArgumentRequest> = [];
		for (const param of paramsUnsatisfied) {
			argumentRequests.push({
				param: param.name,
				info: await param.getArgRequestInfo(),
			});
		}
		return argumentRequests;
	}
	action.call(args);
	return [];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const query = (apiAction: APIAction = api, apiQuery: APIQuery = {
	name: api.name,
	nameShort: api.nameShort ?? api.name,
	isInvocable: false,
	actions: {},
}): APIQuery => {
	Object.entries(apiAction.actions).forEach(([ key, action ]) => {
		apiQuery.actions[key] = {
			name: action.name,
			nameShort: action.nameShort ?? action.name,
			isInvocable: !!action.call,
			actions: {},
		};
		query(action, apiQuery.actions[key]);
	});
	return apiQuery;
};
