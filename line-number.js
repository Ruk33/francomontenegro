const codes = document.getElementsByTagName("code");
for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    code.innerHTML = code.innerHTML.trim();
    const parent = code.parentElement;
    const lines = code.textContent.split("\n").length;
    let newHTML = `<span class="line-number">`;
    for (let j = 0; j < lines; j++) {
        newHTML += `<span>${j + 1}</span>`;
    }
    newHTML += `</span>`;
    parent.innerHTML = newHTML + parent.innerHTML;
}
