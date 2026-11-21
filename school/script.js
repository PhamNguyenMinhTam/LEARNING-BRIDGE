const resources = mockResources.map((resource) => ({ ...resource }));
const statusLabels = { pending: "Chờ duyệt", approved: "Đã chấp thuận", rejected: "Đã từ chối" };
const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" });
const select = (id) => document.getElementById(id);

const search = select("search");
const typeFilter = select("type-filter");
const statusFilter = select("status-filter");
const sort = select("sort");
const historyFilter = select("history-filter");
const reviewDialog = select("review-dialog");
const confirmDialog = select("confirm-dialog");
const note = select("review-note");
let currentResource;
let reviewTrigger;
let proposedStatus;
let decisionTrigger;

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function badge(status) {
  return element("span", statusLabels[status], "badge " + status);
}

function dateLabel(value) {
  return dateFormat.format(new Date(value.length === 10 ? value + "T00:00:00" : value));
}

function normalize(text) {
  return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d");
}

function renderSummary() {
  for (const status of Object.keys(statusLabels)) {
    select(status + "-count").textContent = resources.filter((resource) => resource.status === status).length;
  }
}

function matchingResources() {
  const query = normalize(search.value.trim());
  const items = resources.filter((resource) =>
    (!typeFilter.value || resource.resourceType === typeFilter.value) &&
    (!statusFilter.value || resource.status === statusFilter.value) &&
    [resource.title, resource.contributorName, resource.subject].some((value) => normalize(value).includes(query))
  );
  const order = {
    newest: (a, b) => b.submittedAt.localeCompare(a.submittedAt),
    oldest: (a, b) => a.submittedAt.localeCompare(b.submittedAt),
    title: (a, b) => a.title.localeCompare(b.title, "vi")
  };
  return items.sort(order[sort.value]);
}

function resourceRow(resource) {
  const row = document.createElement("tr");
  const identity = row.insertCell();
  identity.append(
    element("span", resource.title, "resource-title"),
    element("span", resource.contributorName, "muted")
  );

  const values = [
    ["Môn học", element("span", resource.subject)],
    ["Loại", element("span", resource.resourceType)],
    ["Ngày gửi", element("time", dateLabel(resource.submittedAt))],
    ["Trạng thái", badge(resource.status)]
  ];
  values[2][1].dateTime = resource.submittedAt;
  for (const [label, value] of values) {
    const cell = row.insertCell();
    cell.dataset.label = label;
    cell.append(value);
  }

  const actions = element("div", "", "actions row-actions");
  const labels = resource.status === "pending" ? ["Xem chi tiết", "Kiểm duyệt"] : ["Xem chi tiết"];
  for (const label of labels) {
    const button = element("button", label, "button");
    button.type = "button";
    button.setAttribute("aria-label", label + " · " + resource.title);
    button.addEventListener("click", () => openReview(resource, button, label === "Kiểm duyệt"));
    actions.append(button);
  }
  row.insertCell().append(actions);
  return row;
}

function renderResources() {
  const items = matchingResources();
  select("resources").replaceChildren(...items.map(resourceRow));
  select("resource-table").hidden = !items.length;
  select("empty").hidden = Boolean(items.length);
  select("result-count").textContent = items.length + " tài liệu";
}

function historyItem(resource) {
  const item = document.createElement("li");
  const date = element("time", dateLabel(resource.reviewedAt));
  date.dateTime = resource.reviewedAt;
  const byline = element("p", resource.contributorName + " · ", "muted");
  byline.append(date);
  item.append(element("strong", resource.title, "resource-title"), byline, badge(resource.status));
  if (resource.reviewNote) item.append(element("p", resource.reviewNote));
  return item;
}

function renderHistory() {
  const items = resources
    .filter((resource) => resource.reviewedAt && (!historyFilter.value || resource.status === historyFilter.value))
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
  select("history-list").replaceChildren(...items.map(historyItem));
  select("history-empty").hidden = Boolean(items.length);
}

function setNoteError(message) {
  select("note-error").textContent = message;
  note.setAttribute("aria-invalid", String(Boolean(message)));
}

function renderMetadata(resource) {
  const details = [
    ["Người đăng", resource.contributorName],
    ["Môn học / lĩnh vực", resource.subject],
    ["Loại tài liệu", resource.resourceType],
    ["Mô tả", resource.description],
    ["Chủ đề", resource.topics.join(", ")],
    ["Ngày gửi", dateLabel(resource.submittedAt)],
    ["Nguồn", resource.sourceName],
    ["Quyền sử dụng", resource.rightsInformation]
  ];
  select("metadata").replaceChildren(...details
    .filter(([, value]) => value)
    .flatMap(([label, value]) => [element("dt", label), element("dd", value)]));
}

function openReview(resource, trigger, focusNote) {
  currentResource = resource;
  reviewTrigger = trigger;
  select("detail-title").textContent = resource.title;
  select("detail-status").replaceChildren(badge(resource.status));
  renderMetadata(resource);

  const pending = resource.status === "pending";
  select("decision-fields").hidden = !pending;
  const past = select("past-decision");
  past.hidden = pending;
  past.replaceChildren();
  if (!pending) {
    past.append(element("p", "Ngày kiểm duyệt: " + dateLabel(resource.reviewedAt)));
    if (resource.reviewNote) past.append(element("p", resource.reviewNote));
  }
  note.value = "";
  setNoteError("");
  reviewDialog.scrollTop = 0;
  reviewDialog.showModal();
  (focusNote ? note : select("detail-title")).focus();
}

function requestDecision(status, trigger) {
  if (status === "rejected" && !note.value.trim()) {
    setNoteError("Vui lòng nhập lý do từ chối.");
    note.focus();
    return;
  }

  proposedStatus = status;
  decisionTrigger = trigger;
  select("confirm-message").textContent = status === "approved"
    ? "Bạn muốn chấp thuận tài liệu này?"
    : "Bạn muốn từ chối tài liệu này?";
  confirmDialog.returnValue = "";
  confirmDialog.showModal();
}

confirmDialog.addEventListener("close", () => {
  if (!reviewDialog.open) return;
  if (confirmDialog.returnValue !== "confirm") {
    decisionTrigger.focus();
    return;
  }
  Object.assign(currentResource, {
    status: proposedStatus,
    reviewNote: note.value.trim(),
    reviewedAt: new Date().toISOString()
  });
  renderSummary();
  renderResources();
  renderHistory();
  reviewDialog.close();
  select("review-status").textContent = currentResource.title + " · " + statusLabels[proposedStatus] + ". " +
    select("demo-notice").textContent;
});

reviewDialog.addEventListener("close", () => {
  (reviewTrigger?.isConnected ? reviewTrigger : statusFilter).focus();
});

select("close-review").addEventListener("click", () => reviewDialog.close());
select("approve").addEventListener("click", (event) => requestDecision("approved", event.currentTarget));
select("reject").addEventListener("click", (event) => requestDecision("rejected", event.currentTarget));
note.addEventListener("input", () => {
  if (note.value.trim()) setNoteError("");
});

select("filters").addEventListener("submit", (event) => event.preventDefault());
search.addEventListener("input", renderResources);
for (const control of [typeFilter, statusFilter, sort]) control.addEventListener("change", renderResources);
select("clear-filters").addEventListener("click", () => {
  select("filters").reset();
  statusFilter.value = "";
  renderResources();
  search.focus();
});
historyFilter.addEventListener("change", renderHistory);

function updateNavigation() {
  const active = window.location.hash || "#overview";
  for (const link of document.querySelectorAll(".sidebar nav a")) {
    if (link.hash === active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", updateNavigation);

const resourceTypes = [...new Set(resources.map((resource) => resource.resourceType))].sort((a, b) => a.localeCompare(b, "vi"));
for (const type of resourceTypes) typeFilter.add(new Option(type, type));
updateNavigation();
renderSummary();
renderResources();
renderHistory();
