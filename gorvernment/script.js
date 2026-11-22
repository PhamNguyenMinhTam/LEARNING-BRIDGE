"use strict";

const content = document.querySelector("#content");
const title = document.querySelector("#title");
const feedback = document.querySelector("#feedback");
const dialog = document.querySelector("#details");
const confirmation = document.querySelector("#confirmation");
const menu = document.querySelector("#menu");
const demoMessage = "Thao tác được mô phỏng trên giao diện. Chưa lưu vào hệ thống.";
const role = "Quản trị viên trường";
const statusLabels = {
  active: "Hoạt động", inactive: "Ngừng hoạt động",
  pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Đã từ chối"
};
const ruleTypes = {
  numeric: "Chỉ chữ số", prefix: "Tiền tố + chữ số",
  alphanumeric: "Chữ cái và chữ số", custom: "Hai nhóm chữ số (tùy chỉnh)"
};
const collator = new Intl.Collator("vi", { sensitivity: "base" });
const formatter = new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC" });
const filterState = {
  schools: { search: "", type: "", status: "", sort: "newest" },
  reviews: { search: "", type: "", status: "", sort: "newest" }
};
let selectedSchool = state.schools[0].code;

function element(tag, className = "", value = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function button(label, action, className = "") {
  const node = element("button", className, label);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function link(label, href, className = "") {
  const node = element("a", className, label);
  node.href = href;
  return node;
}

function group(className, ...children) {
  const node = element("div", className);
  node.append(...children);
  return node;
}

function badge(status) {
  return element("span", `badge ${status}`, statusLabels[status]);
}

function dateLabel(date) {
  return date ? formatter.format(new Date(date)) : "—";
}

function today() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map(part => String(part).padStart(2, "0")).join("-");
}

function schoolName(code) {
  return state.schools.find(school => school.code === code).name;
}

function statusOptions(keys) {
  return keys.map(key => [key, statusLabels[key]]);
}

function field(name, label, value = "", options = {}) {
  const wrapper = element("div", "field");
  const input = element(options.choices ? "select" : options.multiline ? "textarea" : "input");
  input.name = name;
  input.id = options.id || `field-${name}`;
  if (options.choices) {
    for (const choice of options.choices) {
      const [key, label] = Array.isArray(choice) ? choice : [choice, choice];
      input.add(new Option(label, key));
    }
  } else if (options.multiline) {
    input.rows = 3;
  } else {
    input.type = options.type || "text";
  }
  if (options.min != null) input.min = options.min;
  if (options.max != null) input.max = options.max;
  if (options.maxLength) input.maxLength = options.maxLength;
  input.value = value;
  input.required = Boolean(options.required);
  input.readOnly = Boolean(options.readOnly);
  const caption = element("label", "", label + (options.required ? " *" : ""));
  caption.htmlFor = input.id;
  const error = element("p", "error");
  error.id = `${input.id}-error`;
  error.setAttribute("aria-live", "polite");
  input.setAttribute("aria-describedby", error.id);
  input.addEventListener("input", () => fieldError(input, ""));
  wrapper.append(caption, input, error);
  return wrapper;
}

function fieldError(input, message) {
  input.setAttribute("aria-invalid", String(Boolean(message)));
  document.getElementById(input.getAttribute("aria-describedby")).textContent = message;
}

function formFor(fields, label, save) {
  const form = element("form", "stack");
  const submit = element("button", "primary", label);
  submit.type = "submit";
  form.noValidate = true;
  form.append(...fields, group("actions", submit));
  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()]));
    let firstInvalid;
    function fail(name, message) {
      const input = form.elements.namedItem(name);
      fieldError(input, message);
      firstInvalid ||= input;
    }
    for (const input of form.querySelectorAll("input, select, textarea")) {
      fieldError(input, "");
      if (input.disabled) continue;
      if (input.required && !data[input.name]) fail(input.name, "Vui lòng điền trường này.");
      else if (input.validity.typeMismatch) fail(input.name, "Vui lòng nhập địa chỉ email hợp lệ.");
      else if (!input.validity.valid) fail(input.name, "Giá trị nằm ngoài phạm vi cho phép.");
    }
    if (!firstInvalid) save(data, fail);
    firstInvalid?.focus();
  });
  return form;
}

function dialogHeader(target, heading, id, closeLabel) {
  const caption = element("h2", "", heading);
  caption.id = id;
  target.replaceChildren(group("dialog-head", caption, button(closeLabel, () => target.close())));
}

function openDetails(heading, ...body) {
  dialogHeader(dialog, heading, "dialog-title", "Đóng");
  dialog.append(...body);
  dialog.showModal();
}

function confirmAction(heading, message, action, danger = false) {
  dialogHeader(confirmation, heading, "confirmation-title", "Hủy");
  confirmation.append(group("stack", element("p", "", message), element("p", "muted", demoMessage),
    group("actions", button("Xác nhận", () => {
      confirmation.close();
      action();
    }, danger ? "danger" : "primary"))));
  confirmation.showModal();
}

function finish(message, focusId) {
  if (dialog.open) dialog.close();
  render();
  if (focusId) document.getElementById(focusId)?.focus();
  feedback.textContent = `${message} ${demoMessage}`;
}

function details(items) {
  const list = element("dl");
  for (const [label, value] of items) {
    const term = element("dd");
    term.append(value || "—");
    list.append(element("dt", "", label), term);
  }
  return list;
}

function table(caption, headers, rows) {
  if (!rows.length) return element("p", "card muted", "Không tìm thấy bản ghi phù hợp.");
  const wrapper = element("div", "card table-wrap");
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "region");
  wrapper.setAttribute("aria-label", caption);
  const node = element("table");
  node.setAttribute("role", "table");
  node.createCaption().textContent = caption;
  const header = node.createTHead();
  header.setAttribute("role", "rowgroup");
  const head = header.insertRow();
  head.setAttribute("role", "row");
  for (const label of headers) {
    const column = element("th", "", label);
    column.scope = "col";
    column.setAttribute("role", "columnheader");
    head.append(column);
  }
  const body = node.createTBody();
  body.setAttribute("role", "rowgroup");
  for (const values of rows) {
    const row = body.insertRow();
    row.setAttribute("role", "row");
    values.forEach((value, index) => {
      const cell = row.insertCell();
      cell.setAttribute("role", "cell");
      cell.dataset.label = headers[index];
      cell.append(value);
    });
  }
  wrapper.append(node);
  return wrapper;
}

function sortRecords(records, order, nameKey) {
  return [...records].sort((a, b) => {
    if (order === "name") return collator.compare(a[nameKey], b[nameKey]);
    const dateOrder = a.date.localeCompare(b.date);
    return order === "oldest" ? dateOrder : -dateOrder;
  });
}

function normalize(value) {
  return value.toLocaleLowerCase("vi").normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
}

function filtered(records, filters, keys, nameKey) {
  const query = normalize(filters.search.trim());
  return sortRecords(records.filter(record =>
    (!filters.type || record.type === filters.type) &&
    (!filters.status || record.status === filters.status) &&
    keys.some(key => normalize(record[key]).includes(query))
  ), filters.sort, nameKey);
}

function filterBar(page, searchLabel, types, statuses, sortLabel, update) {
  const values = filterState[page];
  const bar = group("card toolbar",
    field("search", searchLabel, values.search, { type: "search" }),
    field("type", "Loại", values.type, { choices: [["", "Tất cả"], ...types] }),
    field("status", "Trạng thái", values.status, { choices: [["", "Tất cả"], ...statusOptions(statuses)] }),
    field("sort", "Sắp xếp", values.sort, { choices: [["newest", "Mới nhất"], ["oldest", "Cũ nhất"], ["name", sortLabel]] }));
  for (const control of bar.querySelectorAll("input, select")) {
    control.addEventListener(control.type === "search" ? "input" : "change", () => {
      values[control.name] = control.value;
      update();
    });
  }
  return bar;
}

function preview(heading, records, display, actionLabel, route) {
  const list = element("ul", "preview");
  for (const record of records.slice(0, 5)) {
    const item = element("li");
    item.append(element("span", "", display(record)), element("time", "muted", dateLabel(record.date)));
    list.append(item);
  }
  return group("card", element("h2", "", heading),
    records.length ? list : element("p", "muted", "Chưa có bản ghi."),
    link(actionLabel, route));
}

function overview() {
  const pending = state.resources.filter(resource => resource.status === "pending");
  const stats = [
    ["Tổng số trường", state.schools.length, "#schools"],
    ["Trường hoạt động", state.schools.filter(school => school.status === "active").length, "#schools"],
    ["Trường ngừng hoạt động", state.schools.filter(school => school.status === "inactive").length, "#schools"],
    ["Tài khoản School", state.accounts.length, "#accounts"],
    ["Tài liệu chờ duyệt", pending.length, "#reviews"],
    ["Tài liệu đã duyệt", state.resources.filter(resource => resource.status === "approved").length, "#reviews"]
  ];
  const summary = group("stats", ...stats.map(([label, count, route]) => {
    const card = link(label, route, "card stat");
    card.append(element("strong", "", count));
    return card;
  }));
  content.append(summary, group("panels",
    preview("Trường được thêm gần đây", sortRecords(state.schools, "newest", "name"),
      school => school.name, "Mở quản lý trường", "#schools"),
    preview("Tài liệu đang chờ duyệt", sortRecords(pending, "newest", "title"),
      resource => resource.title, "Mở danh sách kiểm duyệt", "#reviews")));
}

function schoolDetails(school) {
  const rule = state.rules[school.code];
  const accounts = state.accounts.filter(account => account.school === school.code);
  openDetails(school.name, details([
    ["Mã trường", school.code], ["Loại cơ sở", school.type], ["Email", school.email],
    ["Điện thoại", school.phone], ["Trạng thái", badge(school.status)], ["Ngày tạo", dateLabel(school.date)],
    ["Quy tắc mã giáo viên", rule ? `${ruleTypes[rule.type]} · ${rule.example}` : "Chưa cấu hình"],
    ["Tài khoản School", `${accounts.length} tài khoản · ${accounts.filter(account => account.status === "active").length} hoạt động`]
  ]));
}

function editSchool(school) {
  const form = formFor([
    field("name", "Tên trường", school?.name, { required: true, maxLength: 150 }),
    field("code", "Mã trường", school?.code, { required: true, readOnly: Boolean(school), maxLength: 30 }),
    field("type", "Loại cơ sở giáo dục", school?.type || institutionTypes[0], { choices: institutionTypes, required: true }),
    field("email", "Email liên hệ", school?.email, { type: "email" }),
    field("phone", "Điện thoại liên hệ", school?.phone, { type: "tel", maxLength: 35 }),
    field("status", "Trạng thái", school?.status || "active", { choices: statusOptions(["active", "inactive"]), required: true })
  ], "Lưu bản ghi", (values, fail) => {
    const code = values.code.toUpperCase();
    if (!school && state.schools.some(item => item.code === code)) {
      fail("code", "Mã trường đã tồn tại.");
      return;
    }
    const save = () => {
      if (school) Object.assign(school, values);
      else state.schools.unshift({ ...values, code, date: today() });
      finish(school ? "Đã cập nhật bản ghi trường." : "Đã thêm bản ghi trường.", "add-school");
    };
    if (school && school.status !== values.status) {
      confirmAction("Đổi trạng thái trường", `Chuyển ${school.name} sang trạng thái “${statusLabels[values.status]}”?`, save, values.status === "inactive");
    } else save();
  });
  openDetails(school ? "Chỉnh sửa trường" : "Thêm trường đã xác minh", form);
}

function toggleStatus(record, label, focusId) {
  const next = record.status === "active" ? "inactive" : "active";
  const action = next === "active" ? "Kích hoạt" : "Ngừng hoạt động";
  confirmAction(action, `Chuyển ${label} sang trạng thái “${statusLabels[next]}”?`, () => {
    record.status = next;
    finish("Đã cập nhật trạng thái bản ghi.", focusId);
  }, next === "inactive");
}

function schools() {
  const results = group("stack");
  const add = button("Thêm trường", () => editSchool(), "primary");
  add.id = "add-school";
  function update() {
    const records = filtered(state.schools, filterState.schools, ["name", "code"], "name");
    results.replaceChildren(table("Danh sách trường", ["Mã trường", "Tên trường", "Loại cơ sở", "Liên hệ", "Trạng thái", "Ngày tạo", "Thao tác"],
      records.map(school => [
        school.code, school.name, school.type, [school.email, school.phone].filter(Boolean).join(" · ") || "—",
        badge(school.status), dateLabel(school.date), group("actions",
          button("Chi tiết", () => schoolDetails(school)),
          button("Sửa", () => editSchool(school)),
          button(school.status === "active" ? "Ngừng hoạt động" : "Kích hoạt",
            () => toggleStatus(school, school.name, "add-school"))
        )
      ])));
  }
  content.append(group("actions", add),
    filterBar("schools", "Tìm theo tên hoặc mã trường", institutionTypes, ["active", "inactive"], "Tên A–Z", update), results);
  update();
}
function matchesRule(rule, sample) {
  const digits = (value, count) => /^\d+$/.test(value) && (!count || value.length === Number(count));
  if (!sample.startsWith(rule.prefix)) return false;
  const body = sample.slice(rule.prefix.length);
  if (rule.type === "alphanumeric") {
    return /^[a-z0-9]+$/i.test(body) && (!rule.digits || body.length === Number(rule.digits));
  }
  if (rule.type === "custom") {
    const split = Number(rule.digits);
    return digits(body.slice(0, split), rule.digits) &&
      body.slice(split, split + rule.separator.length) === rule.separator &&
      digits(body.slice(split + rule.separator.length), rule.suffix);
  }
  return digits(body, rule.digits);
}

function schoolChoices() {
  return sortRecords(state.schools, "name", "name").map(school => [school.code, `${school.code} · ${school.name}`]);
}

function editRule(code) {
  const rule = state.rules[code] || {};
  const form = formFor([
    field("school-name", "Trường", schoolName(code), { readOnly: true }),
    field("type", "Loại quy tắc", rule.type || "numeric", { choices: Object.entries(ruleTypes), required: true }),
    field("prefix", "Tiền tố", rule.prefix, { maxLength: 20 }),
    field("digits", "Số chữ số", rule.digits, { type: "number", min: 1, max: 40 }),
    field("separator", "Dấu phân cách", rule.separator, { maxLength: 4 }),
    field("suffix", "Số chữ số nhóm sau", rule.suffix, { type: "number", min: 1, max: 40 }),
    field("example", "Mã ví dụ", rule.example, { required: true, maxLength: 120 }),
    field("description", "Mô tả", rule.description, { multiline: true, maxLength: 500 })
  ], "Lưu quy tắc", (values, fail) => {
    const { type, example, description } = values;
    const config = { type, example, description, prefix: values.prefix || "", digits: values.digits || "",
      separator: values.separator || "", suffix: values.suffix || "" };
    if (!matchesRule(config, example)) {
      fail("example", "Mã ví dụ chưa khớp cấu hình.");
      return;
    }
    confirmAction("Lưu quy tắc mã giáo viên", `Áp dụng quy tắc cho ${schoolName(code)}?`, () => {
      state.rules[code] = config;
      finish("Đã cập nhật quy tắc mã giáo viên.", "rule-school");
    });
  });
  const controls = form.elements;
  function configure() {
    const type = controls.namedItem("type").value;
    const settings = [
      ["prefix", type !== "numeric", type === "prefix", "Tiền tố"],
      ["digits", true, type !== "alphanumeric", type === "alphanumeric" ? "Số ký tự sau tiền tố" : "Số chữ số nhóm đầu"],
      ["separator", type === "custom", true, "Dấu phân cách"],
      ["suffix", type === "custom", true, "Số chữ số nhóm sau"]
    ];
    for (const [name, enabled, required, label] of settings) {
      const input = controls.namedItem(name);
      input.disabled = !enabled;
      input.required = enabled && required;
      const wrapper = input.closest(".field");
      wrapper.hidden = !enabled;
      wrapper.querySelector("label").textContent = label + (input.required ? " *" : "");
      if (form.isConnected) fieldError(input, "");
    }
  }
  controls.namedItem("type").addEventListener("change", configure);
  configure();
  openDetails("Chỉnh sửa quy tắc", element("p", "notice",
    "Thay đổi quy tắc định dạng có thể ảnh hưởng đến việc đăng ký tài khoản mới. Các tài khoản hiện có không được tự động sửa đổi."), form);
}

function rules() {
  const selection = field("school", "Chọn trường", selectedSchool, { id: "rule-school", choices: schoolChoices() });
  const current = group("card stack");
  function update() {
    const rule = state.rules[selectedSchool];
    current.replaceChildren(element("h2", "", "Quy tắc hiện tại"));
    if (rule) {
      current.append(details([
        ["Loại quy tắc", ruleTypes[rule.type]], ["Tiền tố", rule.prefix],
        [rule.type === "alphanumeric" ? "Số ký tự sau tiền tố" : "Số chữ số nhóm đầu", rule.digits],
        ["Dấu phân cách", rule.separator], ["Số chữ số nhóm sau", rule.suffix],
        ["Mã ví dụ", rule.example], ["Mô tả", rule.description]
      ]));
    } else current.append(element("p", "muted", "Trường này chưa có quy tắc."));
    current.append(group("actions", button(rule ? "Sửa quy tắc" : "Thêm quy tắc", () => editRule(selectedSchool), "primary")));
    if (!rule) return;
    const result = element("p");
    result.setAttribute("role", "status");
    const sample = field("sample", "Nhập mã giáo viên để kiểm tra", "", { required: true, maxLength: 120 });
    sample.querySelector("input").addEventListener("input", () => { result.textContent = ""; });
    const form = formFor([sample], "Kiểm tra định dạng", (values, fail) => {
      if (!matchesRule(rule, values.sample)) {
        fail("sample", "Mã không khớp với quy tắc.");
        return;
      }
      result.className = "success";
      result.textContent = "Mã khớp định dạng.";
    });
    current.append(form, result, element("p", "muted", "Kết quả chỉ phản ánh định dạng của mã. Danh tính giáo viên cần được xác minh riêng."));
  }
  selection.querySelector("select").addEventListener("change", event => {
    selectedSchool = event.target.value;
    update();
  });
  const rows = sortRecords(state.schools, "name", "name").map(school => {
    const rule = state.rules[school.code];
    return [school.code, school.name, rule ? ruleTypes[rule.type] : "Chưa cấu hình", rule?.example || "—"];
  });
  content.append(group("card", selection), current,
    table("Định dạng mã theo trường", ["Mã trường", "Tên trường", "Loại quy tắc", "Mã ví dụ"], rows));
  update();
}

function createAccount() {
  openDetails("Thêm bản ghi tài khoản School", formFor([
    field("school", "Trường", "", { choices: [["", "Chọn trường"], ...schoolChoices()], required: true }),
    field("username", "Tên tài khoản", "", { required: true, maxLength: 60 }),
    field("role", "Vai trò", role, { readOnly: true }),
    field("status", "Trạng thái", "active", { choices: statusOptions(["active", "inactive"]), required: true })
  ], "Tiếp tục", ({ school, username, status }, fail) => {
    if (state.accounts.some(account => account.username.toLowerCase() === username.toLowerCase())) {
      fail("username", "Tên tài khoản đã tồn tại.");
      return;
    }
    confirmAction("Thêm bản ghi tài khoản", `Thêm bản ghi “${username}” cho ${schoolName(school)}?`, () => {
      state.accounts.unshift({ school, username, status, date: today() });
      finish("Đã thêm bản ghi tài khoản School.", "add-account");
    });
  }));
}

function accounts() {
  const add = button("Thêm bản ghi tài khoản", createAccount, "primary");
  add.id = "add-account";
  const rows = sortRecords(state.accounts, "newest", "username").map(account => {
    const profile = [
      ["Tên trường", schoolName(account.school)], ["Tên tài khoản", account.username],
      ["Vai trò", role], ["Trạng thái", statusLabels[account.status]], ["Ngày tạo", dateLabel(account.date)]
    ];
    return [...profile.map(([label, value]) => label === "Trạng thái" ? badge(account.status) : value), group("actions",
      button("Chi tiết", () => openDetails("Chi tiết tài khoản School", details(profile))),
      button(account.status === "active" ? "Ngừng hoạt động" : "Kích hoạt",
        () => toggleStatus(account, account.username, "add-account"))
    )];
  });
  content.append(group("actions", add),
    table("Danh sách tài khoản School", ["Tên trường", "Tên tài khoản", "Vai trò", "Trạng thái", "Ngày tạo", "Thao tác"], rows));
}

function reviewDetails(resource) {
  const body = group("stack", details([
    ["Mô tả", resource.description], ["Người đóng góp", resource.contributor],
    ["Môn / lĩnh vực", resource.subject], ["Chủ đề", resource.topics.join(" · ")],
    ["Loại tài liệu", resource.type], ["Ngày gửi", dateLabel(resource.date)],
    ["Nguồn", resource.source], ["Quyền sử dụng", resource.rights], ["Trạng thái", badge(resource.status)]
  ]), element("p", "card muted", "Chưa có bản xem trước tài liệu."));
  if (resource.status !== "pending") {
    body.append(details([["Ngày quyết định", dateLabel(resource.reviewed)], ["Ghi chú kiểm duyệt", resource.note]]));
    openDetails(resource.title, body);
    return;
  }
  const noteField = field("note", "Ghi chú kiểm duyệt", "", { multiline: true, maxLength: 1000 });
  const note = noteField.querySelector("textarea");
  function decide(status) {
    const message = note.value.trim();
    if (status === "rejected" && !message) {
      fieldError(note, "Vui lòng nhập lý do từ chối.");
      note.focus();
      return;
    }
    const action = status === "approved" ? "Duyệt tài liệu" : "Từ chối tài liệu";
    confirmAction(action, `${action} “${resource.title}” trong bản demo?`, () => {
      Object.assign(resource, { status, note: message, reviewed: today() });
      finish("Đã ghi nhận quyết định kiểm duyệt.", "field-search");
    }, status === "rejected");
  }
  body.append(noteField, group("actions",
    button("Duyệt", () => decide("approved"), "primary"),
    button("Từ chối", () => decide("rejected"), "danger")));
  openDetails(resource.title, body);
}

function reviews() {
  const results = group("stack");
  function update() {
    const records = filtered(state.resources, filterState.reviews, ["title", "contributor", "subject"], "title");
    results.replaceChildren(table("Danh sách tài liệu độc lập", ["Tên tài liệu", "Người đóng góp", "Môn / lĩnh vực", "Loại", "Ngày gửi", "Trạng thái", "Thao tác"],
      records.map(resource => [
        resource.title, resource.contributor, resource.subject, resource.type, dateLabel(resource.date),
        badge(resource.status), group("actions", button("Chi tiết", () => reviewDetails(resource)))
      ])));
  }
  content.append(filterBar("reviews", "Tìm tên, người đóng góp hoặc môn", resourceTypes,
    ["pending", "approved", "rejected"], "Tiêu đề A–Z", update), results);
  update();
}

const pages = {
  overview: ["Tổng quan", "Theo dõi trường, tài khoản và tài liệu độc lập bằng dữ liệu mô phỏng.", overview],
  schools: ["Quản lý trường", "Thêm bản ghi sau khi trường đã hoàn tất đăng ký và xác minh ngoại tuyến.", schools],
  rules: ["Quy tắc mã giáo viên", "Cấu hình và thử định dạng mã giáo viên theo từng trường.", rules],
  accounts: ["Tài khoản School", "Quản lý bản ghi mô phỏng dành cho quản trị viên trường.", accounts],
  reviews: ["Kiểm duyệt tài liệu độc lập", "Xem xét thủ công tài liệu do người đóng góp ngoài các trường gửi.", reviews]
};

function render() {
  const route = location.hash.slice(1);
  const page = Object.hasOwn(pages, route) ? route : "overview";
  const [label, description, display] = pages[page];
  title.textContent = label;
  document.querySelector("#intro").textContent = description;
  feedback.textContent = "";
  content.replaceChildren();
  for (const item of document.querySelectorAll('nav a[href^="#"]')) {
    if (item.hash === `#${page}`) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  display();
}

menu.addEventListener("click", () => {
  menu.setAttribute("aria-expanded", String(menu.getAttribute("aria-expanded") !== "true"));
});
document.querySelector("nav").addEventListener("click", event => {
  if (event.target.matches('a[href^="#"]')) {
    menu.setAttribute("aria-expanded", "false");
    if (event.target.hash === location.hash) title.focus();
  }
});
window.addEventListener("hashchange", () => {
  if (confirmation.open) confirmation.close();
  if (dialog.open) dialog.close();
  menu.setAttribute("aria-expanded", "false");
  render();
  title.focus();
});
render();