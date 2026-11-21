"use strict";

const byId = id => document.getElementById(id);
const queryInput = byId("query");
const filterForm = byId("filter-form");
const filterDialog = byId("filter-dialog");
const resourceDialog = byId("resource-dialog");
const mobile = window.matchMedia("(max-width: 760px)");
const pageSize = 6;
const filterDefinitions = [
  ["domain", "Lĩnh vực", "Tất cả lĩnh vực", "domains"],
  ["level", "Bậc học", "Tất cả bậc học", "educationLevels"],
  ["type", "Loại tài liệu", "Tất cả loại tài liệu", "resourceType"],
  ["language", "Ngôn ngữ", "Tất cả ngôn ngữ", "language"],
  ["access", "Quyền truy cập", "Tất cả quyền truy cập", "accessType"]
];
const categories = [
  ["school", "school", "Sách, bài tập và đề cương."],
  ["higher", "cap", "Giáo trình, bài giảng và slide."],
  ["research", "research", "Bài báo và chuyên đề nghiên cứu."],
  ["self", "code", "Hướng dẫn và tài liệu thực hành."]
];
const icons = {
  search: "M21 21l-4.4-4.4 M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  book: "M12 6v15 M12 6C8 3 4 4 2 5v14c3-1 7-1 10 2 3-3 7-3 10-2V5c-2-1-6-2-10 1Z",
  school: "M3 21h18 M5 21V9l7-5 7 5v12 M9 21v-6h6v6 M12 8v2",
  cap: "M2 9l10-5 10 5-10 5-10-5Z M6 11v6c4 3 8 3 12 0v-6 M22 9v8",
  research: "M9 3h6 M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3 M7 15h10",
  code: "M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 4l-4 16",
  file: "M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6",
  slides: "M2 4h20v13H2z M12 17v4 M8 21h8 M6 13l4-4 3 2 4-4",
  pencil: "M4 16L16 4l4 4-12 12-5 1z M14 6l4 4",
  arrow: "M5 12h14 M13 6l6 6-6 6"
};
const typeIcons = {
  textbook: "book", reference: "book", lecture: "file", slides: "slides",
  exercises: "pencil", exam: "file", paper: "research", guide: "book"
};

const state = { query: "", filters: {}, sort: "relevance", page: 1 };
const vietnameseOrder = new Intl.Collator("vi");
const catalog = resources
  .filter(resource => resource.publicationStatus === "published" && resource.accessVisibility === "public")
  .map(resource => ({
    resource,
    title: normalizeText(resource.title),
    topics: normalizeText([...resource.topics, ...resource.keywords].join(" ")),
    description: normalizeText(resource.description),
    other: normalizeText([
      ...resource.authors, resource.contributor, resource.courseName,
      resource.courseCode, resource.isbn, resource.doi
    ].filter(Boolean).join(" "))
  }));

function normalizeText(value) {
  return value.toLowerCase().replace(/đ/g, "d").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ");
}

function calculateRelevance(entry, query, terms) {
  if (!query) return 0;
  const weights = terms.map(term => {
    if (entry.title.includes(term)) return 8;
    if (entry.topics.includes(term)) return 4;
    if (entry.other.includes(term)) return 3;
    if (entry.description.includes(term)) return 2;
    return 0;
  });
  if (weights.includes(0)) return -1;
  const score = weights.reduce((total, weight) => total + weight, 0) / terms.length;
  if (entry.title === query) return score + 30;
  if (entry.title.includes(query)) return score + 12;
  return score;
}

function searchResources(query) {
  const terms = query ? [...new Set(query.split(" "))] : [];
  return catalog.map(entry => ({
    resource: entry.resource,
    score: calculateRelevance(entry, query, terms)
  })).filter(entry => entry.score >= 0);
}

function filterResources(matches) {
  return matches.filter(({ resource }) => filterDefinitions.every(([key, , , field]) => {
    const selected = state.filters[key];
    return !selected || [].concat(resource[field]).includes(selected);
  }));
}

function sortResources(matches) {
  return matches.sort((a, b) => {
    const yearA = a.resource.publicationYear;
    const yearB = b.resource.publicationYear;
    if (state.sort === "title") return vietnameseOrder.compare(a.resource.title, b.resource.title);
    if (state.sort === "newest") return (yearB ?? -Infinity) - (yearA ?? -Infinity);
    if (state.sort === "oldest") return (yearA ?? Infinity) - (yearB ?? Infinity);
    return b.score - a.score;
  });
}

function paginateResources(matches) {
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * pageSize;
  return { pages, visible: matches.slice(start, start + pageSize) };
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function button(className, label, onClick) {
  const node = element("button", className, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function icon(name) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", icons[name]);
  svg.append(path);
  return svg;
}

function groupLabels(key, values) {
  return values.map(value => resourceGroups[key][value]).join(", ");
}

function metadata(fields) {
  const list = element("dl", "metadata");
  for (const [label, value] of fields) {
    if (value) {
      const item = element("div");
      item.append(element("dt", "", label), element("dd", "", value));
      list.append(item);
    }
  }
  return list;
}

function coreMetadata(resource) {
  return [
    ["Tác giả", resource.authors.join(", ")],
    ["Người đóng góp", resource.contributor],
    ["Lĩnh vực", groupLabels("domain", resource.domains)],
    ["Bậc học", groupLabels("level", resource.educationLevels)],
    ["Ngôn ngữ", resourceGroups.language[resource.language]],
    ["Năm xuất bản", resource.publicationYear],
    ["Quyền truy cập", resourceGroups.access[resource.accessType]]
  ];
}

function openResourceDetails(resource) {
  const title = element("h2", "", resource.title);
  title.id = "detail-title";
  const content = byId("detail-content");
  content.replaceChildren(
    element("p", "type-label", resourceGroups.type[resource.resourceType]),
    title,
    element("p", "description", resource.description),
    metadata([
      ...coreMetadata(resource),
      ["Môn học", resource.courseName], ["Mã môn học", resource.courseCode],
      ["Chủ đề", resource.topics.join(", ")], ["Từ khóa", resource.keywords.join(", ")],
      ["Nguồn", resource.sourceName], ["Loại nguồn", resource.sourceType],
      ["ISBN", resource.isbn], ["DOI", resource.doi], ["Giấy phép", resource.license]
    ])
  );
  if (resource.sourceUrl) {
    const link = element("a", "primary", "Xem tại nguồn");
    link.href = resource.sourceUrl;
    content.append(link);
  } else {
    content.append(element("p", "access-note", "Đây là tài liệu minh họa. Chưa có liên kết truy cập."));
  }
  resourceDialog.showModal();
}

function resourceCard(resource) {
  const card = element("article", "resource-card");
  const top = element("div", "resource-top");
  const symbol = element("span", "tile-icon");
  symbol.append(icon(typeIcons[resource.resourceType]));
  top.append(symbol, element("span", "type-label", resourceGroups.type[resource.resourceType]));
  const details = button("text-button details-button", "Xem chi tiết", () => openResourceDetails(resource));
  details.setAttribute("aria-label", "Xem chi tiết " + resource.title);
  details.append(icon("arrow"));
  card.append(
    top, element("h3", "", resource.title), element("p", "description", resource.description),
    metadata(coreMetadata(resource)), element("p", "source", resource.sourceName), details
  );
  return card;
}

function renderResources(visible) {
  const container = byId("resources");
  if (visible.length) {
    container.replaceChildren(...visible.map(resourceCard));
    return;
  }
  const empty = element("div", "empty-state");
  const symbol = element("span", "tile-icon");
  symbol.append(icon("search"));
  empty.append(symbol, element("h3", "", "Không tìm thấy tài liệu"),
    element("p", "", "Hãy thử từ khóa khác hoặc xóa một số bộ lọc."),
    Object.keys(state.filters).length
      ? button("secondary", "Xóa bộ lọc", () => clearFilters(byId("results-title")))
      : button("secondary", "Đặt lại tìm kiếm", () => resetSearch(byId("results-title")))
  );
  container.replaceChildren(empty);
}

function renderActiveFilters() {
  const chips = byId("active-filters");
  chips.replaceChildren();
  if (state.query) {
    chips.append(button("chip", "Đặt lại tìm kiếm ×", () => resetSearch(byId("results-title"))));
  }
  for (const [key, label] of filterDefinitions) {
    if (!state.filters[key]) continue;
    const value = resourceGroups[key][state.filters[key]];
    const chip = button("chip", value + " ×", () => {
      delete state.filters[key];
      refreshFromFirstPage();
      byId("results-title").focus({ preventScroll: true });
    });
    chip.setAttribute("aria-label", "Xóa bộ lọc " + label + " " + value);
    chips.append(chip);
  }
  if (Object.keys(state.filters).length) {
    chips.append(button("text-button", "Xóa tất cả bộ lọc", () => clearFilters(byId("results-title"))));
  }
  for (const category of byId("categories").children) {
    category.setAttribute("aria-pressed", String(category.dataset.level === state.filters.level));
  }
}

function renderPagination(pages) {
  const pagination = byId("pagination");
  pagination.replaceChildren();
  pagination.hidden = pages < 2;
  if (pages < 2) return;

  function pageButton(label, target, accessibleLabel) {
    const control = button("secondary", label, () => {
      state.page = target;
      render();
      goToResults();
    });
    control.setAttribute("aria-label", accessibleLabel);
    return control;
  }

  const previous = pageButton("‹", state.page - 1, "Trang trước");
  previous.disabled = state.page === 1;
  pagination.append(previous);
  for (let page = 1; page <= pages; page += 1) {
    const control = pageButton(String(page), page, "Trang " + page);
    if (page === state.page) control.setAttribute("aria-current", "page");
    pagination.append(control);
  }
  const next = pageButton("›", state.page + 1, "Trang sau");
  next.disabled = state.page === pages;
  pagination.append(next);
}

function render() {
  const matches = sortResources(filterResources(searchResources(normalizeText(state.query))));
  const { pages, visible } = paginateResources(matches);
  byId("result-count").textContent = matches.length + " tài liệu";
  renderActiveFilters();
  renderResources(visible.map(entry => entry.resource));
  renderPagination(pages);
}

function syncFilters() {
  for (const [key] of filterDefinitions) filterForm.elements[key].value = state.filters[key] || "";
}

function refreshFromFirstPage() {
  state.page = 1;
  syncFilters();
  render();
}

function goToResults() {
  byId("results-title").focus({ preventScroll: true });
  byId("explore").scrollIntoView({ block: "start" });
}

function clearFilters(focusTarget) {
  state.filters = {};
  refreshFromFirstPage();
  focusTarget.focus({ preventScroll: true });
}

function resetSearch(focusTarget) {
  state.query = "";
  queryInput.value = "";
  byId("clear-query").hidden = true;
  refreshFromFirstPage();
  focusTarget.focus({ preventScroll: true });
}

function applyFilters() {
  state.filters = Object.fromEntries([...new FormData(filterForm)].filter(([, value]) => value));
  refreshFromFirstPage();
}

for (const [key, label, all] of filterDefinitions) {
  const field = element("div", "filter-field");
  const caption = element("label", "", label);
  caption.htmlFor = "filter-" + key;
  const select = element("select");
  select.id = caption.htmlFor;
  select.name = key;
  select.add(new Option(all, ""));
  for (const [value, name] of Object.entries(resourceGroups[key])) select.add(new Option(name, value));
  field.append(caption, select);
  byId("filter-fields").append(field);
}

for (const [level, symbol, description] of categories) {
  const category = button("category", "", () => {
    state.filters.level = state.filters.level === level ? "" : level;
    if (!state.filters.level) delete state.filters.level;
    refreshFromFirstPage();
    goToResults();
  });
  category.dataset.level = level;
  const badge = element("span", "tile-icon");
  badge.append(icon(symbol));
  const copy = element("span", "category-copy");
  copy.append(element("strong", "", resourceGroups.level[level]), element("span", "", description));
  category.append(badge, copy);
  byId("categories").append(category);
}

for (const slot of document.querySelectorAll("[data-icon]")) slot.append(icon(slot.dataset.icon));

byId("search-form").addEventListener("submit", event => {
  event.preventDefault();
  state.query = queryInput.value.trim().replace(/\s+/g, " ");
  queryInput.value = state.query;
  byId("clear-query").hidden = !state.query;
  refreshFromFirstPage();
  goToResults();
});
queryInput.addEventListener("input", () => {
  byId("clear-query").hidden = !queryInput.value;
  if (!queryInput.value && state.query) resetSearch(queryInput);
});
byId("clear-query").addEventListener("click", () => resetSearch(queryInput));
byId("sort").addEventListener("change", event => {
  state.sort = event.target.value;
  state.page = 1;
  render();
});

filterForm.addEventListener("change", () => {
  if (!filterDialog.open) applyFilters();
});
filterForm.addEventListener("submit", event => {
  event.preventDefault();
  applyFilters();
  if (filterDialog.open) filterDialog.close();
});
byId("clear-filters").addEventListener("click", event => {
  if (filterDialog.open) filterForm.reset();
  else clearFilters(event.currentTarget);
});
byId("open-filters").addEventListener("click", () => {
  syncFilters();
  filterDialog.append(filterForm);
  filterDialog.showModal();
});
byId("close-filters").addEventListener("click", () => filterDialog.close());
filterDialog.addEventListener("close", () => {
  byId("filter-sidebar").append(filterForm);
  syncFilters();
});
mobile.addEventListener("change", ({ matches }) => {
  if (!matches && filterDialog.open) {
    filterDialog.close();
    byId("results-title").focus({ preventScroll: true });
  }
});

for (const dialog of [filterDialog, resourceDialog]) {
  let startedOutside = false;
  dialog.addEventListener("pointerdown", event => { startedOutside = event.target === dialog; });
  dialog.addEventListener("click", event => {
    if (startedOutside && event.target === dialog) dialog.close();
    startedOutside = false;
  });
}

const menuToggle = byId("menu-toggle");
menuToggle.addEventListener("click", () => {
  menuToggle.setAttribute("aria-expanded", String(menuToggle.getAttribute("aria-expanded") === "false"));
});
byId("navigation").addEventListener("click", event => {
  if (event.target.closest("a")) menuToggle.setAttribute("aria-expanded", "false");
});

render();
