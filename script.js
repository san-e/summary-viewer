const GIST_URL =
  "https://api.github.com/gists/7d60a4793305ee49b7ea6e05f07ff7f9";

let data = null;
let selected = null;
let cache_db = null;
let expanded = new Set();
const idsToNames = {
  2657588: "Grundzüge digitaler Systeme",
  2658050: "Einführung in die Programmierung 1",
  2673357: "Algebra und Diskrete Mathematik",
  2761974: "Denkweisen der Informatik",
  2765061: "Mathematisches Arbeiten",
};

// Generate URL-safe ID from string
const toId = (str) => str.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();

function constructOpencastURL(id, e) {
  return `https://tuwel.tuwien.ac.at/mod/opencast/view.php?id=${id}&e=${e}`;
}

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('cache-db', 1);

      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('pages')) {
          db.createObjectStore('pages');
        }
      };

      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
  }

  return dbPromise;
}

function putPage(key, html) {
  return new Promise((resolve, reject) => {
    const tx = cache_db.transaction('pages', 'readwrite');
    const store = tx.objectStore('pages');

    store.put(html, key);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getPage(key) {
  return new Promise((resolve, reject) => {
    const tx = cache_db.transaction('pages', 'readonly');
    const store = tx.objectStore('pages');

    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}



function escapeLatex(markdown) {
  const MD_SPECIAL_CHARS = /[\\`*_{}\[\]()#+\-!.|>~<>]/g;

  const escapeMarkdownChars = (str) =>
    str.replace(MD_SPECIAL_CHARS, (ch) => `\\${ch}`);

  // Block math: $$...$$ (handle first)
  markdown = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_, content) => {
    return `$$${escapeMarkdownChars(content)}$$`;
  });

  // Inline math: $...$ (exclude $$)
  markdown = markdown.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_, content) => {
    return `$${escapeMarkdownChars(content)}$`;
  });

  return markdown;
}

async function get_db_gist() {
  let response = await fetch(GIST_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  let text = await response.json();
  return LZString.decompressFromEncodedURIComponent(
    text["files"]["summary_db.json"]["content"],
  );
}

// Initialize the app
async function init() {
  try {
    cache_db = await getDB();
    if (document.cookie) {
      selectPost(document.cookie);
    }
    data = JSON.parse(await get_db_gist(GIST_URL));

    const titles = Object.keys(data);
    if (titles.length) {
      expanded.add(document.cookie || titles[0]);
      selectPost(document.cookie || titles[0]);
    }
    renderNav();
  } catch (err) {
    console.log(err);
    document.getElementById("article").innerHTML = `
      <div class="error">
        <p>Error loading data</p>
        <p>${err.message}</p>
      </div>
    `;
  }
}

function fuckMobileHonestly() {
  document.getElementById("mySidenav").style.top =
    `${document.querySelector("header").offsetHeight}px`;
  if (document.getElementById("mySidenav").style.width == "0px") {
    document.getElementById("mySidenav").style.width = "280px";
  } else {
    document.getElementById("mySidenav").style.width = "0px";
  }
}

async function invalidateCache() {
  const tx = cache_db.transaction('pages', 'readwrite');
  await tx.objectStore('pages').clear();
}

async function cacheHTML(id, html) {
  await putPage("cached_gist", JSON.stringify(data));
  await putPage(id, JSON.stringify(html));
}

// Render the navigation sidebar
async function renderNav() {
  let cached_gist = await getPage("cached_gist");
  let titles = Object.keys(data || cached_gist);

  let navContent = titles
    .map((title) => {
      let subs;
      if (data) {
        subs = Object.keys(data[title]);
      } else if (Object.keys(cached_gist).includes(title)) {
        subs = cached_gist[title];
      }
      const isExpanded = expanded.has(title);
      const isActive = selected === title;

      const chevron = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
    </svg>`;

      const subsectionsHtml = isExpanded
        ? `
      <ul class="subsections">
        ${subs
          .map(
            (sub, i) => `
          <li>
            <button 
              class="sub-btn" 
              onclick="scrollToSection('${escapeQuotes(title)}', '${toId(sub)}')"
              title="${escapeHtml(sub)}"
            >
              ${i + 1}. ${escapeHtml((data[title][sub] || cached_gist[title][sub]).split("\n")[0].replace("#", "") || sub.slice(0, 24))}
            </button>
          </li>
        `,
          )
          .join("")}
      </ul>
    `
        : "";

      return `
      <li>
        <button 
          class="post-btn ${isActive ? "active" : ""} ${isExpanded ? "expanded" : ""}"
          onclick="handlePostClick('${escapeQuotes(title)}')"
        >
          ${chevron}
          ${escapeHtml(idsToNames[title])}
        </button>
        ${subsectionsHtml}
      </li>
    `;
    })
    .join("");

  document.getElementById("nav").innerHTML = navContent;
  document.getElementById("mySidenav").innerHTML = navContent;
}

// Handle clicking on a post title
function handlePostClick(title) {
  document.cookie = title;
  if (expanded.has(title)) {
    expanded.delete(title);
    renderNav();
    return;
  } else {
    expanded.clear();
    expanded.add(title);
  }
  selectPost(title);
  renderNav();
}

// Select and display a post
async function selectPost(title) {
  selected = title;
  if((JSON.stringify(data) === await getPage("cached_gist") || data === null) &&
      await getPage(title) != undefined) {
    console.log("cache hit! " + title);
    document.getElementById("article").innerHTML = JSON.parse(await getPage(title));
    renderNav();
    return;
  }

  invalidateCache();
  const post = data[title] || {};
  const entries = Object.entries(post);

  const sectionCountHtml =
    entries.length > 1
      ? `<p class="section-count">${entries.length} sections</p>`
      : "";

  const sectionsHtml = entries
    .map(([key, content]) => {
      content = content.replace(/\{ts\}([\d:.]+)\{\/ts\}/g, "");
      content = escapeLatex(content);
      content = marked.parse(content);
      let firstLine = content.split("\n")[0];
      content = content.replace(
        firstLine,
        `<a href=${constructOpencastURL(title, key)}>${firstLine}</a>`,
      );
      return `<div class="section" id="${toId(key)}">
      <div class="prose">${content}</div>
    </div>`;
    })
    .join("");

  document.getElementById("article").innerHTML = `
    <div class="fade-in">
      <h2 class="post-title">${escapeHtml(idsToNames[title])}</h2>
      ${sectionCountHtml}
      ${sectionsHtml}
    </div>
  `;
  renderMathInElement(document.body, {
    // customised options
    // • auto-render specific keys, e.g.:
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
      { left: "\\[", right: "\\]", display: true },
    ],
    // • rendering keys, e.g.:
    throwOnError: false,
  });
  renderNav();
  cacheHTML(title, document.getElementById("article").innerHTML);
}

// Scroll to a specific section
async function scrollToSection(title, sectionId) {
  if (selected !== title) {
    await selectPost(title);
    if (!expanded.has(title)) {
      expanded.add(title);
      renderNav();
    }
  }

  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 50);
}

// Utility: escape quotes for onclick attributes
function escapeQuotes(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// Utility: escape HTML to prevent XSS
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Start the app
init();
