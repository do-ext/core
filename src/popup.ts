const style = document.createElement("style");
style.textContent = `
#action-select-panel {
    min-width: 280px;
}
`;
document.head.appendChild(style);

document.head.appendChild(styleCreate());
panelInsert(document.body);
