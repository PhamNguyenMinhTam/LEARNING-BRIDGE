"use strict";

const dialog = document.querySelector("#details");
const confirmation = document.querySelector("#confirmation");
const demoMessage = "Thao tác được mô phỏng trên giao diện. Chưa lưu vào hệ thống.";

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

function filterBar(values, searchLabel, types, statuses, sortLabel, update) {
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
