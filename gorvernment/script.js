(() => {
  const { request, url } = bridge;
  const { node, field, form, button, perform, pager, details, external, date } = bridgeUI;
  const content = document.querySelector('#content');
  const heading = document.querySelector('#title');
  const status = document.querySelector('#feedback');
  const guardStatus = document.querySelector('#guard-status');
  const modal = document.querySelector('#details');
  const menu = document.querySelector('#menu');
  const base = '/government';
  const statuses = { active: 'Đang hoạt động', suspended: 'Đình chỉ',
    pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };
  let navigation = 0;

  function card(title) {
    const panel = node('section', null, 'card stack');
    panel.append(node('h2', title));
    return panel;
  }

  async function overview() {
    const [active, suspended, pending] = await Promise.all([
      request(base + '/schools', { query: { limit: 1, status: 'active' } }),
      request(base + '/schools', { query: { limit: 1, status: 'suspended' } }),
      request(base + '/reviews/pending', { query: { limit: 1 } })
    ]);
    const grid = node('div', null, 'stats');
    for (const [label, number, hash] of [
      ['Trường hoạt động', active.pagination.total, 'schools'], ['Trường đình chỉ', suspended.pagination.total, 'schools'],
      ['Bài độc lập chờ duyệt', pending.pagination.total, 'reviews']
    ]) {
      const shortcut = node('a', label, 'card stat');
      shortcut.href = '#' + hash;
      shortcut.append(node('strong', number));
      grid.append(shortcut);
    }
    return grid;
  }

  function managedSchools(mode) {
    const root = node('div', null, 'stack');
    const list = card('Danh sách trường');
    const result = node('div', null, 'stack');
    let query = {};
    let selectedId;
    let sequence = 0;
    const load = async (page = 1) => {
      const current = ++sequence;
      result.replaceChildren(node('p', 'Đang tải…'));
      try {
        const data = await request(base + '/schools', { query: { ...query, page, limit: 12 } });
        if (current !== sequence) return;
        result.replaceChildren();
        if (!data.data.length) result.append(node('p', 'Không tìm thấy trường.'));
        for (const school of data.data) {
          const row = card(school.school_name);
          row.append(node('p', school.school_code + ' · ' + statuses[school.status]));
          const select = button(mode === 'accounts' ? 'Xem tài khoản trường' : 'Xem ' + school.school_name, () =>
            perform(select, status, async () => { await selectSchool(school.id); status.textContent = ''; }));
          row.append(select);
          result.append(row);
        }
        result.append(pager(data.pagination, load));
      } catch (error) {
        if (current === sequence) result.replaceChildren(node('p', error.message));
      }
    };
    const editor = node('div', null, 'stack');
    async function selectSchool(id) {
      selectedId = id;
      const school = await request(base + '/schools/' + id);
      if (selectedId !== id) return;
      const panel = card(school.school_name + ' · ' + school.school_code);
      editor.replaceChildren(panel);
      if (mode === 'schools') {
        panel.append(node('p', statuses[school.status]), form([
          field('Tên trường', 'school_name', { value: school.school_name, maxLength: 200 })
        ], 'Lưu tên trường', async body => {
          await request(base + '/schools/' + id, { method: 'PATCH', body });
          await Promise.all([selectSchool(id), load()]);
          status.textContent = 'Đã cập nhật tên trường.';
        }, status));
        const toggle = button(school.status === 'active' ? 'Đình chỉ trường' : 'Kích hoạt trường', () =>
          perform(toggle, status, async () => {
            if (!confirm('Xác nhận thay đổi trạng thái trường?')) { status.textContent = ''; return; }
            await request(base + '/schools/' + id + '/status', { method: 'PATCH',
              body: { status: school.status === 'active' ? 'suspended' : 'active' } });
            await Promise.all([selectSchool(id), load()]);
            status.textContent = 'Đã cập nhật trạng thái trường.';
          }));
        panel.append(toggle);
      } else if (mode === 'rules') {
        panel.append(node('p', 'Pattern hiện hành: ' + school.teacher_id_pattern),
          node('p', 'Pattern chỉ kiểm tra định dạng mã, không xác minh danh tính hay tư cách thuộc trường.'),
          form([field('Pattern mã giáo viên', 'teacher_id_pattern', { value: school.teacher_id_pattern, maxLength: 255 })],
            'Lưu pattern', async body => {
              await request(base + '/schools/' + id + '/teacher-id-pattern', { method: 'PATCH', body });
              await selectSchool(id);
              status.textContent = 'Đã lưu pattern.';
            }, status));
      } else {
        const accounts = node('div', null, 'stack');
        async function loadAccounts(page = 1) {
          accounts.replaceChildren(node('p', 'Đang tải tài khoản…'));
          try {
            const data = await request(base + '/schools/' + id + '/admins', { query: { page, limit: 12 } });
            accounts.replaceChildren();
            if (!data.data.length) accounts.append(node('p', 'Trường chưa có quản trị viên.'));
            for (const account of data.data) {
              const row = node('div', null, 'actions');
              row.append(node('p', account.full_name + ' · ' + account.email + ' · ' + statuses[account.status]));
              const toggle = button(account.status === 'active' ? 'Đình chỉ tài khoản' : 'Kích hoạt tài khoản', () =>
                perform(toggle, status, async () => {
                  if (!confirm('Xác nhận thay đổi trạng thái tài khoản?')) { status.textContent = ''; return; }
                  await request(base + '/admins/' + account.id + '/status', { method: 'PATCH',
                    body: { status: account.status === 'active' ? 'suspended' : 'active' } });
                  await loadAccounts(page);
                  status.textContent = 'Đã cập nhật tài khoản.';
                }));
              row.append(toggle);
              accounts.append(row);
            }
            accounts.append(pager(data.pagination, loadAccounts));
          } catch (error) { accounts.replaceChildren(node('p', error.message)); }
        }
        panel.append(node('p', 'Chuyển mật khẩu ban đầu qua kênh bảo mật.'), form([
          field('Họ tên', 'full_name', { maxLength: 150 }), field('Email', 'email', { type: 'email' }),
          field('Mật khẩu ban đầu', 'password', { type: 'password' })
        ], 'Cấp tài khoản School Admin', async (body, accountForm) => {
          if ([...body.password].length < 12) throw new Error('Mật khẩu phải có ít nhất 12 ký tự.');
          await request(base + '/schools/' + id + '/admins', { method: 'POST', body });
          accountForm.reset();
          await loadAccounts();
          status.textContent = 'Đã cấp tài khoản School Admin.';
        }, status), accounts);
        await loadAccounts();
      }
    }

    if (mode === 'schools') {
      const createPanel = card('Thêm trường');
      createPanel.append(form([field('Mã trường', 'school_code', { maxLength: 30 }),
        field('Tên trường', 'school_name', { maxLength: 200 }),
        field('Pattern mã giáo viên', 'teacher_id_pattern', { maxLength: 255 })
      ], 'Tạo trường', async (body, createForm) => {
        const school = await request(base + '/schools', { method: 'POST', body });
        createForm.reset();
        await Promise.all([load(), selectSchool(school.id)]);
        status.textContent = 'Đã tạo trường.';
      }, status));
      root.append(createPanel);
    }
    list.append(form([field('Tìm trường', 'search', { required: false, maxLength: 100 }),
      field('Trạng thái', 'status', { required: false, values: [['', 'Tất cả'], ['active', 'Đang hoạt động'], ['suspended', 'Đình chỉ']] })
    ], 'Tìm trường', async filters => { query = filters; await load(); status.textContent = ''; }, status, 'toolbar'), result);
    root.append(list, editor);
    load();
    return root;
  }

  function reviewWorkspace() {
    const panel = card('Hàng chờ và lịch sử');
    const entries = node('div', null, 'stack');
    let filters = { kind: 'pending' };
    let sequence = 0;
    async function load(page = 1) {
      const current = ++sequence;
      entries.replaceChildren(node('p', 'Đang tải…'));
      try {
        const { kind, search } = filters;
        const query = { page, limit: 12, search };
        if (kind === 'approved' || kind === 'rejected') query.decision = kind;
        const data = await request(base + '/reviews/' + (kind === 'pending' ? 'pending' : 'history'), { query });
        if (current !== sequence) return;
        entries.replaceChildren();
        if (!data.data.length) entries.append(node('p', 'Không có hồ sơ phù hợp.'));
        for (const item of data.data) {
          const row = node('div', null, 'actions');
          row.append(node('strong', item.title), node('span', statuses[item.decision] + ' · V' + item.version_number),
            button('Xem kiểm duyệt ' + item.title, () => openReview(item.review_id)));
          entries.append(row);
        }
        entries.append(pager(data.pagination, load));
      } catch (error) {
        if (current === sequence) entries.replaceChildren(node('p', error.message));
      }
    }

    async function openReview(id) {
      const title = node('h2', 'Đang tải chi tiết…');
      title.id = 'dialog-title';
      const feedback = node('p', '');
      feedback.setAttribute('role', 'status');
      const dialogBody = node('div', null, 'stack');
      modal.replaceChildren(title, button('Đóng', () => modal.close()), dialogBody, feedback);
      if (!modal.open) modal.showModal();
      try {
        const item = await request(base + '/reviews/' + id);
        title.textContent = item.title;
        dialogBody.append(details([['Resource ID', item.resource_id], ['Phiên bản', item.version_number],
          ['Tác giả', item.author_name], ['Mô tả', item.description], ['Nộp ngày', date(item.submitted_at)],
          ['Loại', item.resource_type], ['Quyền phân phối', item.rights_basis], ['Truy cập', item.access_level],
          ['Quyết định', statuses[item.decision]], ['Nhận xét', item.review_note]]));
        if (item.has_file) {
          const file = node('a', 'Tải PDF để kiểm tra');
          file.href = url(base + '/reviews/' + id + '/preview');
          dialogBody.append(file);
        }
        if (item.source_url) {
          try { dialogBody.append(external(item.source_url)); }
          catch { dialogBody.append(node('p', 'URL nguồn không hợp lệ.')); }
        }
        if (item.decision === 'pending') {
          const remarks = field('Nhận xét kiểm duyệt', 'note', { type: 'textarea', required: false, maxLength: 2000 });
          async function decide(action) {
            if (approve.disabled || reject.disabled) return;
            const note = remarks.querySelector('textarea').value.trim();
            if (action === 'reject' && !note) {
              feedback.textContent = 'Vui lòng nhập lý do từ chối.';
              remarks.querySelector('textarea').focus();
              return;
            }
            approve.disabled = reject.disabled = true;
            feedback.textContent = 'Đang gửi quyết định…';
            try {
              const result = await request(base + '/reviews/' + id + '/' + action, {
                method: 'POST', body: note ? { note } : {}
              });
              modal.close();
              await load();
              status.textContent = statuses[result.decision] + (result.publication_occurred ? ' và đã xuất bản.' :
                ' · Trạng thái xuất bản: ' + (result.publication_status === 'published' ? 'đang xuất bản.' : 'đang ẩn.'));
            } catch (error) {
              if (error.status === 409) {
                modal.close();
                await load();
                status.textContent = error.message;
              } else feedback.textContent = error.message;
            } finally { approve.disabled = reject.disabled = false; }
          }
          const approve = button('Chấp thuận', () => decide('approve'), 'button primary');
          const reject = button('Từ chối', () => decide('reject'), 'button danger');
          dialogBody.append(remarks, approve, reject);
        }
      } catch (error) { feedback.textContent = error.message; }
    }

    panel.append(form([field('Trạng thái kiểm duyệt', 'kind', { values: [['pending', 'Chờ duyệt'], ['history', 'Lịch sử'],
      ['approved', 'Đã duyệt'], ['rejected', 'Từ chối']], value: 'pending' }),
    field('Tìm theo tiêu đề', 'search', { required: false, maxLength: 100 })], 'Áp dụng', async values => {
      filters = values; await load(); status.textContent = '';
    }, status, 'toolbar'), entries);
    load();
    return panel;
  }

  function withdrawal() {
    const panel = card('Rút xuất bản');
    panel.append(node('p', 'Nhập Resource ID để rút bản công khai. Lý do được kiểm tra khi gửi và chưa có nhật ký lưu bền vững.'),
      form([field('Resource ID', 'id'), field('Lý do rút xuất bản', 'reason', { type: 'textarea', maxLength: 2000 })],
        'Rút xuất bản', async ({ id, reason }) => {
          if (!/^[1-9][0-9]{0,19}$/.test(id)) throw new Error('Resource ID không hợp lệ.');
          if (!confirm('Xác nhận rút xuất bản tài liệu?')) { status.textContent = ''; return; }
          const result = await request(base + '/resources/' + id + '/withdraw', { method: 'POST', body: { reason } });
          status.textContent = 'Resource ' + result.resource_id + ': ' +
            (result.publication_status === 'hidden' ? 'đang ẩn.' : result.publication_status);
        }, status));
    return panel;
  }

  const views = {
    overview: ['Tổng quan', overview],
    schools: ['Quản lý trường', () => managedSchools('schools')],
    rules: ['Quy tắc mã giáo viên', () => managedSchools('rules')],
    accounts: ['Tài khoản School', () => managedSchools('accounts')],
    reviews: ['Kiểm duyệt tài liệu độc lập', () => {
      const stack = node('div', null, 'stack');
      stack.append(reviewWorkspace(), withdrawal());
      return stack;
    }]
  };

  async function render() {
    const current = ++navigation;
    const route = location.hash.slice(1);
    const key = Object.hasOwn(views, route) ? route : 'overview';
    const [label, view] = views[key];
    heading.textContent = label;
    status.textContent = '';
    content.replaceChildren(node('p', 'Đang tải…'));
    menu.setAttribute('aria-expanded', 'false');
    if (modal.open) modal.close();
    for (const link of document.querySelectorAll('nav a[href^="#"]')) {
      if (link.hash === '#' + key) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    try {
      const section = await view();
      if (current === navigation) content.replaceChildren(section);
    } catch (error) {
      if (current === navigation) content.replaceChildren(node('p', error.message));
    }
  }

  menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(menu.getAttribute('aria-expanded') !== 'true')));
  (async () => {
    const user = await bridge.guard('government');
    if (!user) return;
    document.querySelector('#government-profile').textContent = user.full_name;
    bridge.logout(document.querySelector('#logout'), status);
    document.querySelector('.layout').hidden = false;
    guardStatus.hidden = true;
    addEventListener('hashchange', () => { render(); heading.focus(); });
    await render();
  })().catch(error => { guardStatus.textContent = error.message; });
})();
