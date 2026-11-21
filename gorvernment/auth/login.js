const form = document.querySelector("#login-form");
const username = document.querySelector("#username");
const password = document.querySelector("#password");
const toggle = document.querySelector("#password-toggle");
const toggleLabel = document.querySelector("#password-toggle-label");
const statusMessage = document.querySelector("#login-status");

function showFieldError(input, message) {
  input.setAttribute("aria-invalid", String(Boolean(message)));
  document.getElementById(input.getAttribute("aria-describedby")).textContent = message;
  return !message;
}

function validateUsername() {
  return showFieldError(username, username.value.trim() ? "" : "Vui lòng nhập tên tài khoản.");
}

function validatePassword() {
  return showFieldError(password, password.value === "" ? "Vui lòng nhập mật khẩu." : "");
}

function togglePasswordVisibility() {
  const show = password.type === "password";
  password.type = show ? "text" : "password";
  toggleLabel.textContent = show ? "Ẩn" : "Hiện";
}

function handleLoginSubmit(event) {
  event.preventDefault();
  statusMessage.textContent = "";

  const usernameValid = validateUsername();
  const passwordValid = validatePassword();
  if (!usernameValid || !passwordValid) {
    (usernameValid ? password : username).focus();
    return;
  }

  statusMessage.textContent = "Biểu mẫu hợp lệ. Chức năng xác thực tài khoản sẽ được tích hợp trong giai đoạn tiếp theo.";
}

for (const [input, validate] of [[username, validateUsername], [password, validatePassword]]) {
  input.addEventListener("input", () => {
    statusMessage.textContent = "";
    if (input.hasAttribute("aria-invalid")) validate();
  });
}
toggle.addEventListener("click", togglePasswordVisibility);
form.addEventListener("submit", handleLoginSubmit);
