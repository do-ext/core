const styleInsert = () => {
	const style = document.createElement("style");
	style.textContent = `
#action-select-panel {
	background: hsl(0 0% 80%);
	user-select: none;
}
#action-select-panel * {
	font-family: calibri;
	font-size: 20px;
}
#action-select-panel .entry {
	padding: 4px;
}
#action-select-panel .entry.selected {
	background: hsl(0 0% 90%);
}
#action-select-panel .list.filter .entry:not(.filtered) {
	display: none;
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
	document.querySelectorAll("#action-select-panel .entry.selected").forEach(entry => {
		entry.classList.remove("selected");
	});
	entry.classList.add("selected");
};

const entrySubmit = (entry?: Element) => {
	if (entry) {
		entrySelect(entry);
	}
	entry = document.querySelector("#action-select-panel .entry.selected") ?? undefined;
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

const listFilterStart = () => {
	listFilterEnd();
	const list = document.querySelector("#action-select-panel .list") as Element;
	list.classList.add("filter");
};

const listFilterEnd = () => {
	const list = document.querySelector("#action-select-panel .list") as Element;
	list.classList.remove("filter");
	list.querySelectorAll(".entry.filtered").forEach(entry => {
		entry.classList.remove("filtered");
	});
};

const listFilter = (predicate: (key: string) => boolean) => {
	listFilterStart();
	const list = document.querySelector("#action-select-panel .list") as Element;
	Array.from(list.querySelectorAll(".entry"))
		.filter(entry => predicate((entry.querySelector(".label") as Element).textContent ?? ""))
		.forEach(entry => {
			entry.classList.add("filtered");
		});
	listSelectNth(0);
};

const listGetEntriesFiltered = () =>
	Array.from(document.querySelectorAll("#action-select-panel .list.filter .entry.filtered, .list:not(.filter) .entry"))
;

const listEntriesDeselect = () =>
	document.querySelectorAll("#action-select-panel .list .entry.selected").forEach(entry => {
		entry.classList.remove("selected");
	})
;

const listSelectNth = (index: number) => {
	listEntriesDeselect();
	const entries = listGetEntriesFiltered();
	const entry = entries[(entries.length + index) % entries.length] as Element;
	entry.classList.add("selected");
};

const listGetEntryIndex = (criteria: {
	entry?: Element
	selected?: boolean
}) => {
	const list = document.querySelector("#action-select-panel .list") as Element;
	const entry = criteria.entry ?? (criteria.selected !== undefined ? list.querySelector(".entry.selected") : null);
	const entries = listGetEntriesFiltered();
	return entry ? entries.indexOf(entry) : -1;
};

const panelInsert = (container: HTMLElement) => {
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
			const entrySelectedIdx = listGetEntryIndex({ selected: true });
			const entriesCount = listGetEntriesFiltered().length;
			listEntriesDeselect();
			listSelectNth((entriesCount + entrySelectedIdx + (event.key === "ArrowDown" ? 1 : -1)) % entriesCount);
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
	input.addEventListener("input", () => {
		const inputText = input.value;
		if (!inputText.length) {
			listFilterEnd();
			return;
		}
		listFilter(key => inputText.split(" ").every(text => key.includes(text)));
	});
	addEventListener("mousedown", event => {
		if (!(document.querySelector("#action-select-panel .list") as Element).contains(event.target as Element | null) ) {
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
		listSelectNth(0);
	});
	return panel;
};

styleInsert();
panelInsert(document.body);
