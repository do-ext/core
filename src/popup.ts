const style = document.createElement("style");
style.textContent = `
#action-select-panel {
	display: flex;
	flex-direction: column;
	min-width: 280px;
	max-height: 480px;
}
#action-select-panel .input {
	margin-bottom: 3px;
}
#action-select-panel .list {
	overflow-y: auto;
}
`;
document.head.appendChild(style);

document.head.appendChild(styleCreate());
panelInsert(document.body);
