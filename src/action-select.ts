const styleInsert = () => {
	const style = document.createElement("style");
	style.textContent = `
.action-select-panel {
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

const entryCreate = (key: string) => {
	const panel = document.createElement("div");
	panel.classList.add("entry");
	const label = document.createElement("div");
	label.classList.add("label");
	label.textContent = key;
	panel.appendChild(label);
	return panel;
};

const entrySelect = (entry: Element) => {
	actionselectPanel.querySelectorAll(".entry.selected").forEach(entry => {
		entry.classList.remove("selected");
	});
	entry.classList.add("selected");
};

const entrySubmit = (entry?: Element) => {
	if (entry) {
		entrySelect(entry);
	}
	entry = actionselectPanel.querySelector(".entry.selected") ?? undefined;
	if (!entry) {
		return;
	}
	const key = (entry.querySelector(".label") as Element).textContent ?? "";
	chrome.runtime.sendMessage({
		type: "invocation",
		command: "",
		key,
		args: [],
	});
};

const panelInsert = (container: HTMLElement) => {
	const panel = document.createElement("div");
	panel.classList.add("action-select-panel");
	container.appendChild(panel);
	const list = document.createElement("div");
	list.classList.add("list");
	const input = document.createElement("input");
	input.type = "text";
	input.addEventListener("keydown", event => {
		switch (event.key) {
		case "ArrowDown":
		case "ArrowUp": {
			const entrySelectedIdx = Array.from(list.children).findIndex(child => child.classList.contains("selected"));
			(list.children.item(entrySelectedIdx) as Element).classList.remove("selected");
			const entrySelectedNewIdx = (list.childElementCount + entrySelectedIdx + (event.key === "ArrowDown" ? 1 : -1)) % list.childElementCount;
			(list.children.item(entrySelectedNewIdx) as Element).classList.add("selected");
			break;
		} case "Enter": {
			const entrySelected = Array.from(list.children).find(child => child.classList.contains("selected"));
			if (!entrySelected) {
				break;
			}
			entrySubmit(entrySelected);
			break;
		} case "Tab": {
			break;
		} default: {
			return;
		}}
		event.preventDefault();
	});
	addEventListener("mousedown", event => {
		if (!(actionselectPanel.querySelector(".list") as Element).contains(event.target as Element | null) ) {
			return;
		}
		const entry = (event.target as Element).closest(".entry") as Element;
		entrySubmit(entry);
		event.preventDefault();
	});
	panel.appendChild(input);
	panel.appendChild(list);
	input.focus();
	const loading = entryCreate("Awaiting API…");
	list.appendChild(loading);
	chrome.runtime.sendMessage({ type: "query" }, (apiQuery: APIQuery) => {
		if (!Object.keys(apiQuery).length) {
			return;
		}
		list.replaceChildren();
		getApiQueryKeys(apiQuery).forEach(key => {
			list.appendChild(entryCreate(key));
		});
		list.firstElementChild?.classList.add("selected");
	});
	return panel;
};

styleInsert();
const actionselectPanel = panelInsert(document.body);
