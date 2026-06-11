async function fetchAndFillArchived() {
  const ul = document.createElement("ul");

  const firstUgNeMinorVersion = "17";
  const lastArchived = await fetch("/last_archived_version.json");
  const lastArchivedJson = await lastArchived.json();
  const lastArchivedNeMinorVersion =
    lastArchivedJson.last_archived_version.split(".")[1];

  for (let i = lastArchivedNeMinorVersion; i >= firstUgNeMinorVersion; i--) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `/archived/4.${i}.zip`;
    a.innerHTML = `<span>NetEye 4.${i}</span>`;
    a.innerHTML += `<svg id="icon" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M26,24v4H6V24H4v4H4a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2h0V24Z"/><polygon points="26 14 24.59 12.59 17 20.17 17 2 15 2 15 20.17 7.41 12.59 6 14 16 24 26 14"/><g><rect class="cls-1" fill="none" width="32" height="32"/></g></svg>`;
    li.appendChild(a);
    ul.appendChild(li);
  }

  document.querySelector("#archived-container").appendChild(ul);
}

fetchAndFillArchived();
