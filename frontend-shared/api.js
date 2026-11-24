(() => {
  const pages = { teacher: '/teacher/', school_admin: '/school/', government: '/gorvernment/' };
  const logins = { teacher: '/teacher/auth/login.html', school_admin: '/school/login.html', government: '/gorvernment/auth/login.html' };
  const messages = {
    INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng, hoặc tài khoản không hoạt động.',
    EMAIL_IN_USE: 'Email này đã được sử dụng.',
    SCHOOL_CODE_IN_USE: 'Mã trường này đã được sử dụng.',
    ORIGIN_DENIED: 'Địa chỉ ứng dụng chưa được máy chủ cho phép.',
    TEACHER_CODE_MISMATCH: 'Mã giáo viên không khớp định dạng hiện hành của trường.',
    INVALID_TEACHER_ID_PATTERN: 'Pattern không thuộc cú pháp mã giáo viên được hỗ trợ.',
    SCHOOL_SUSPENDED: 'Trường đang bị đình chỉ.',
    ASSOCIATION_REQUIRED: 'Cần liên kết trường đang hoạt động.',
    ASSOCIATION_EXISTS: 'Liên kết trường đã hoạt động.',
    REVIEW_NOT_PENDING: 'Tài liệu này đã được xử lý. Vui lòng tải lại danh sách.',
    PENDING_REVIEW_EXISTS: 'Tài liệu đã có phiên bản chờ duyệt.',
    ACTIVE_VERSION_EXISTS: 'Tài liệu đã có bản nháp hoặc phiên bản chờ duyệt.',
    INVALID_PDF: 'Tệp không có cấu trúc PDF hợp lệ.',
    INVALID_UPLOAD: 'Vui lòng chọn một tệp PDF.',
    FILE_UNAVAILABLE: 'Tệp PDF hiện không khả dụng.',
    NOT_PUBLISHED: 'Tài liệu hiện không được xuất bản.'
  };
  const statusMessages = {
    400: 'Vui lòng kiểm tra dữ liệu đã nhập.', 401: 'Phiên đăng nhập đã hết hạn.',
    403: 'Bạn không có quyền thực hiện thao tác này.', 404: 'Không tìm thấy dữ liệu hoặc dữ liệu không còn khả dụng.',
    409: 'Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.', 413: 'Tệp hoặc dữ liệu vượt giới hạn kích thước.',
    429: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
  };
  let protectedRole;

  function url(path, query = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== '' && value != null) params.set(key, String(value));
    }
    return '/api' + path + (params.size ? '?' + params : '');
  }

  async function request(path, { method = 'GET', body, query, signal, guest = false, redirect = true } = {}) {
    const form = body instanceof FormData;
    let response;
    try {
      response = await fetch(url(path, query), {
        method, signal, credentials: guest ? 'omit' : 'same-origin',
        headers: body === undefined || form ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined || form ? body : JSON.stringify(body)
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('Không thể kết nối đến máy chủ.');
    }
    const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      const code = data?.error?.code;
      if (response.status === 401 && protectedRole && redirect) location.replace(logins[protectedRole] + '?expired=1');
      throw Object.assign(new Error(messages[code] || statusMessages[response.status] ||
        (response.status >= 500 ? 'Máy chủ tạm thời không khả dụng.' : 'Yêu cầu không thành công.')),
      { status: response.status, code });
    }
    return data;
  }

  async function guard(role) {
    protectedRole = role;
    const user = await request('/auth/me');
    if (user.role !== role) {
      location.replace(pages[user.role] || '/student/');
      return null;
    }
    return user;
  }

  function logout(control, status) {
    control.addEventListener('click', async () => {
      control.disabled = true;
      try {
        await request('/auth/logout', { method: 'POST' });
        location.replace(logins[protectedRole]);
      } catch (error) {
        status.textContent = error.message;
        control.disabled = false;
      }
    });
  }

  window.bridge = { request, url, guard, logout, pages };
})();
