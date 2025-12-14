const GIST_URL = 'https://gist.githubusercontent.com/san-e/7d60a4793305ee49b7ea6e05f07ff7f9/raw/summary_db.json';

let data = null;
let selected = null;
let expanded = new Set();

// Generate URL-safe ID from string
const toId = (str) => str.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

// Initialize the app
async function init() {
  try {
    const res = await fetch(GIST_URL);
    if (!res.ok) throw new Error('Failed to fetch data');

    const text = await res.text();
    
    // Decode base64 with proper UTF-8 handling
    const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
    data = JSON.parse(new TextDecoder('utf-8').decode(bytes));

    const titles = Object.keys(data);
    if (titles.length) {
      expanded.add(titles[0]);
      selectPost(titles[0]);
    }
    renderNav();
  } catch (err) {
    document.getElementById('article').innerHTML = `
      <div class="error">
        <p>Error loading data</p>
        <p>${err.message}</p>
      </div>
    `;
  }
}

// Render the navigation sidebar
function renderNav() {
  const titles = Object.keys(data);
  
  document.getElementById('nav').innerHTML = titles.map((title) => {
    const subs = Object.keys(data[title]);
    const isExpanded = expanded.has(title);
    const isActive = selected === title;

    const chevron = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
    </svg>`;

    const subsectionsHtml = isExpanded ? `
      <ul class="subsections">
        ${subs.map((sub, i) => `
          <li>
            <button 
              class="sub-btn" 
              onclick="scrollToSection('${escapeQuotes(title)}', '${toId(sub)}')"
              title="${escapeHtml(sub)}"
            >
              ${i + 1}. ${escapeHtml(sub.slice(0, 24))}...
            </button>
          </li>
        `).join('')}
      </ul>
    ` : '';

    return `
      <li>
        <button 
          class="post-btn ${isActive ? 'active' : ''} ${isExpanded ? 'expanded' : ''}"
          onclick="handlePostClick('${escapeQuotes(title)}')"
        >
          ${chevron}
          ${escapeHtml(title)}
        </button>
        ${subsectionsHtml}
      </li>
    `;
  }).join('');
}

// Handle clicking on a post title
function handlePostClick(title) {
  if (expanded.has(title)) {
    expanded.delete(title);
  } else {
    expanded.add(title);
  }
  selectPost(title);
  renderNav();
}

// Select and display a post
function selectPost(title) {
  selected = title;
  const post = data[title];
  const entries = Object.entries(post);

  const sectionCountHtml = entries.length > 1 
    ? `<p class="section-count">${entries.length} sections</p>` 
    : '';

  const sectionsHtml = entries.map(([key, content]) => `
    <div class="section" id="${toId(key)}">
      <div class="prose">${marked.parse(content)}</div>
    </div>
  `).join('');

  document.getElementById('article').innerHTML = `
    <div class="fade-in">
      <h2 class="post-title">${escapeHtml(title)}</h2>
      ${sectionCountHtml}
      ${sectionsHtml}
    </div>
  `;

  renderNav();
}

// Scroll to a specific section
function scrollToSection(title, sectionId) {
  if (selected !== title) {
    selectPost(title);
    if (!expanded.has(title)) {
      expanded.add(title);
      renderNav();
    }
  }
  
  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 50);
}

// Utility: escape quotes for onclick attributes
function escapeQuotes(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// Utility: escape HTML to prevent XSS
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Start the app
init();
