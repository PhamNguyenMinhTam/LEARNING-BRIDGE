"use strict";

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

function schoolChoices() {
  return sortRecords(state.schools, "name", "name").map(school => [school.code, `${school.code} · ${school.name}`]);
}
