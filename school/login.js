const form = document.querySelector("#login-form");
const fields = [document.querySelector("#account"), document.querySelector("#password")];
const password = fields[1];
const toggle = document.querySelector("#toggle-password");
const submit = document.querySelector("#login-button");
const status = document.querySelector("#login-status");

function validate(field) {
  const message = field.value.trim() ? "" : {
    account: "Vui lòng nhập tên tài khoản trường.",
    password: "Vui lòng nhập mật khẩu."
  }[field.id];
  document.querySelector("#" + field.id + "-error").textContent = message;
  field.setAttribute("aria-invalid", String(Boolean(message)));
  return !message;
}

for (const field of fields) {
  field.addEventListener("input", () => {
    status.textContent = "";
    if (field.getAttribute("aria-invalid") === "true") validate(field);
  });
}

toggle.addEventListener("click", () => {
  const show = password.type === "password";
  password.type = show ? "text" : "password";
  toggle.textContent = show ? "Ẩn mật khẩu" : "Hiện mật khẩu";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  status.textContent = "";
  const invalid = fields.filter((field) => !validate(field));
  if (invalid.length) {
    invalid[0].focus();
    return;
  }

  password.value = "";
  password.type = "password";
  toggle.textContent = "Hiện mật khẩu";
  submit.disabled = true;
  submit.textContent = "Đang kiểm tra…";
  window.setTimeout(() => {
    submit.disabled = false;
    submit.textContent = "Đăng nhập";
    status.textContent = "Biểu mẫu hợp lệ. Chức năng đăng nhập sẽ được kết nối với hệ thống xác thực ở giai đoạn tiếp theo.";
  }, 220);
});
