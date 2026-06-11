window.addEventListener("load", () => {
    const form = document.querySelector('#topbar #searchform');
    const searchElement = form.querySelector('#search');
    const inputText = searchElement?.shadowRoot.querySelector('#input');

    if(!inputText) {
        return
    }

    inputText.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            form.submit();
        }
    });

    const showSearchButton = document.querySelector("#topbar #show-search");
    showSearchButton?.addEventListener("click", () => {
        form.classList.toggle("show");
        inputText.focus();
    });

    /* Index search */

    const formIndex = document.querySelector('#index-search-container form');
    const searchElementIndex = formIndex?.querySelector('#search');
    const inputTextIndex = searchElementIndex?.shadowRoot.querySelector('#input');

    inputTextIndex?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            formIndex.submit();
        }
    });

});
