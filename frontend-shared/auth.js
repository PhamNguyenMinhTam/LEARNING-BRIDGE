(() => {
  const form = document.querySelector('#auth-form, #login-form');
  const status = document.querySelector('#form-status, #login-status');
  const email = document.querySelector('#email, #account, #username');
  const password = document.querySelector('#password');
  const submit = form.querySelector('button[type=submit]');
  const registering = form.dataset.action === 'register';
  status.hidden = false;
  if (new URLSearchParams(location.search).has('expired')) status.textContent = 'Phiên đăng nhập đã hết hạn.';
  if (new URLSearchParams(location.search).has('registered')) status.textContent = 'Đã tạo tài khoản. Hãy đăng nhập.';

  for (const toggle of document.querySelectorAll('[data-password], #password-toggle, #toggle-password')) {
    const input = document.getElementById(toggle.dataset.password || 'password');
    toggle.addEventListener('click', () => {
      const showing = input.type === 'password';
      input.type = showing ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(showing));
      toggle.textContent = showing ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
    });
  }
  submit.disabled = false;
  form.addEventListener('submit', event => {
    event.preventDefault();
    bridgeUI.perform(submit, status, async () => {
      if (!email.validity.valid || !password.value) throw new Error('Vui lòng nhập email và mật khẩu.');
      const body = { email: email.value, password: password.value };
      if (registering) {
        body.full_name = document.getElementById('full-name').value.trim();
        if (!body.full_name || [...body.password].length < 12) throw new Error('Cần nhập họ tên và mật khẩu ít nhất 12 ký tự.');
        if (body.password !== document.getElementById('confirm-password').value) throw new Error('Mật khẩu nhập lại không khớp.');
        await bridge.request('/auth/register', { method: 'POST', body });
        location.replace('/teacher/auth/login.html?registered=1');
      } else {
        await bridge.request('/auth/login', { method: 'POST', body, redirect: false });
        const user = await bridge.request('/auth/me', { redirect: false });
        location.replace(bridge.pages[user.role] || '/student/');
      }
    });
  });
})();
