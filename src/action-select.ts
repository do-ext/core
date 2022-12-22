const popupStyleInsert = () => {
	const style = document.createElement("style");
	style.textContent = `
#action-select-panel {
	background: hsl(0 0% 80%);
	user-select: none;
}
* {
	font-family: calibri;
	font-size: 20px;
}
.entry {
	padding: 4px;
}
.entry.selected {
	background: hsl(0 0% 100%);
}
	`;
	document.head.appendChild(style);
};

const getApiQueryKeys = (apiQuery: APIQuery, key = ""): Array<string> =>
	Object.entries(apiQuery.actions).flatMap(([ keyLast, query ]) =>
		(query.isInvocable ? [ `${key}${keyLast}` ] : []).concat(getApiQueryKeys(query, `${key}${keyLast}.`))
	)
;

const popupEntryCreate = (key: string) => {
	const panel = document.createElement("div");
	panel.classList.add("entry");
	const label = document.createElement("div");
	label.classList.add("label");
	label.textContent = key;
	panel.appendChild(label);
	return panel;
};

const popupPanelInsert = (container: HTMLElement) => {
	const panel = document.createElement("div");
	panel.id = "action-select-panel";
	container.appendChild(panel);
	const list = document.createElement("div");
	list.classList.add("list");
	const input = document.createElement("input");
	input.type = "text";
	input.addEventListener("keydown", event => {
		switch (event.key) {
		case "ArrowDown":
		case "ArrowUp": {
			const childSelectedIdx = Array.from(list.children).findIndex(child => child.classList.contains("selected"));
			(list.children.item(childSelectedIdx) as Element).classList.remove("selected");
			const childSelectedNewIdx = (list.childElementCount + childSelectedIdx + (event.key === "ArrowDown" ? 1 : -1)) % list.childElementCount;
			(list.children.item(childSelectedNewIdx) as Element).classList.add("selected");
			break;
		} case "Tab": {
			break;
		} default: {
			return;
		}}
		event.preventDefault();
	});
	addEventListener("mousedown", event => {
		event.preventDefault();
	});
	panel.appendChild(input);
	panel.appendChild(list);
	input.focus();
	const loading = popupEntryCreate("Awaiting API…");
	list.appendChild(loading);
	chrome.runtime.sendMessage({ type: "query" }, (apiQuery: APIQuery) => {
		if (!Object.keys(apiQuery).length) {
			return;
		}
		list.replaceChildren();
		getApiQueryKeys(apiQuery).forEach(key => {
			list.appendChild(popupEntryCreate(key));
		});
		list.firstElementChild?.classList.add("selected");
	});
};

popupStyleInsert();
popupPanelInsert(document.body);
