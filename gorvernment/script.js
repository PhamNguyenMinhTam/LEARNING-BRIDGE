"use strict";

const content = document.querySelector("#content");
const title = document.querySelector("#title");
const feedback = document.querySelector("#feedback");
const menu = document.querySelector("#menu");

function finish(message, focusId) {
  if (dialog.open) dialog.close();
  render();
  if (focusId) document.getElementById(focusId)?.focus();
  feedback.textContent = `${message} ${demoMessage}`;
}

function toggleStatus(record, label, focusId) {
  const next = record.status === "active" ? "inactive" : "active";
  const action = next === "active" ? "Kích hoạt" : "Ngừng hoạt động";
  confirmAction(action, `Chuyển ${label} sang trạng thái “${statusLabels[next]}”?`, () => {
    record.status = next;
    finish("Đã cập nhật trạng thái bản ghi.", focusId);
  }, next === "inactive");
}

const pages = {
  overview: ["Tổng quan", "Theo dõi trường, tài khoản và tài liệu độc lập bằng dữ liệu mô phỏng.", renderOverview],
  schools: ["Quản lý trường", "Thêm bản ghi sau khi trường đã hoàn tất đăng ký và xác minh ngoại tuyến.", renderSchools],
  rules: ["Quy tắc mã giáo viên", "Cấu hình và thử định dạng mã giáo viên theo từng trường.", renderRules],
  accounts: ["Tài khoản School", "Quản lý bản ghi mô phỏng dành cho quản trị viên trường.", renderAccounts],
  reviews: ["Kiểm duyệt tài liệu độc lập", "Xem xét thủ công tài liệu do người đóng góp ngoài các trường gửi.", renderReviews]
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
  display(content);
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
