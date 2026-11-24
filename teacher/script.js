(() => {
  const { request } = bridge;
  const { node, field, form, button, perform, pager, details } = bridgeUI;
  const status = document.querySelector('#feedback');
  const links = document.querySelector('#associations');
  const catalog = document.querySelector('#resources');
  const detail = document.querySelector('#resource-details');
  const guardStatus = document.querySelector('#guard-status');
  const labels = { draft: 'Bản nháp', pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Bị từ chối' };
  const rights = [['unknown', 'Chưa rõ'], ['own_work', 'Tự biên soạn'], ['open_license', 'Giấy phép mở'],
    ['authorized_distribution', 'Được phép phân phối'], ['official_link', 'Liên kết nguồn chính thức']];
  let associations = [];
  let available = [];
  let page = 1;

  function metadataFields(version = {}) {
    const input = (label, key, options = {}) => field(label, key, { value: version[key] ?? '', ...options });
    const types = [['authored_document', 'Tài liệu biên soạn / chờ PDF'], ['external_link', 'Liên kết ngoài']];
    if (version.resource_type === 'pdf') types.unshift(['pdf', 'PDF']);
    return [
      input('Tiêu đề', 'title', { maxLength: 255 }), input('Mô tả', 'description', { type: 'textarea' }),
      input('Tên tác giả', 'author_name', { required: false, maxLength: 200 }),
      input('Danh mục', 'category', { maxLength: 100 }), input('Cấp học', 'education_level', { maxLength: 100 }),
      input('Loại tài liệu', 'resource_type', { values: types, value: version.resource_type || 'external_link' }),
      input('URL nguồn HTTPS', 'source_url', { type: 'url', required: false, maxLength: 2048 }),
      input('Căn cứ quyền phân phối', 'rights_basis', { values: rights, value: version.rights_basis || 'unknown' }),
      input('Quyền truy cập', 'access_level', { values: [['restricted', 'Hạn chế'], ['public', 'Công khai khi được duyệt']],
        value: version.access_level || 'restricted' })
    ];
  }

  function metadata(body) {
    body.source_url ||= null;
    if (!body.author_name) delete body.author_name;
    return body;
  }

  async function loadSchools() {
    [available, associations] = await Promise.all([request('/teacher/schools/available'), request('/teacher/schools')]);
    links.replaceChildren(node('h2', 'Liên kết trường'),
      node('p', 'Mã giáo viên chỉ được kiểm tra định dạng.'));
    if (available.length) links.append(form([
      field('Trường', 'school_id', { values: [['', 'Chọn trường'], ...available.map(s => [s.id, s.school_name])] }),
      field('Mã giáo viên', 'teacher_code', { maxLength: 100 })
    ], 'Khai báo liên kết', async body => {
      await request('/teacher/schools', { method: 'POST', body });
      await loadSchools();
      renderCreate();
      status.textContent = 'Đã khai báo liên kết trường.';
    }, status));
    const list = node('ul');
    for (const item of associations) {
      const active = item.status === 'active';
      const row = node('li', item.school_name + ' · ' + item.teacher_code + ' · ' +
        (active ? 'Đang hoạt động' : 'Không hoạt động') + (item.school_status === 'suspended' ? ' · Trường bị đình chỉ' : ''));
      const toggle = button(active ? 'Ngừng liên kết' : 'Kích hoạt liên kết', () => perform(toggle, status, async () => {
        await request('/teacher/schools/' + item.association_id + '/status', {
          method: 'PATCH', body: { status: active ? 'inactive' : 'active' }
        });
        await loadSchools();
        renderCreate();
        status.textContent = 'Đã cập nhật liên kết.';
      }));
      row.append(' ', toggle);
      list.append(row);
    }
    links.append(associations.length ? list : node('p', 'Chưa khai báo liên kết trường.'));
  }

  function renderCreate() {
    catalog.querySelector('form')?.remove();
    const schoolOptions = associations.filter(row => row.status === 'active' && row.school_status === 'active');
    const create = form([
      field('Phạm vi duyệt', 'review_school_id', { required: false, values: [['', 'Đóng góp độc lập'],
        ...schoolOptions.map(row => [row.school_id, row.school_name])] }),
      ...metadataFields()
    ], 'Tạo bản nháp', async body => {
      const review_school_id = body.review_school_id || null;
      const result = await request('/teacher/resources', { method: 'POST', body: {
        ...metadata(body), review_school_id, review_scope: review_school_id ? 'school' : 'government'
      } });
      await Promise.all([loadResources(1), openResource(result.resource_id)]);
      status.textContent = 'Đã tạo bản nháp.';
    }, status);
    catalog.querySelector('h2').after(create);
  }

  async function loadResources(nextPage = page) {
    const result = await request('/teacher/resources', { query: { page: nextPage } });
    page = nextPage;
    const list = catalog.querySelector('.resource-list');
    list.replaceChildren();
    for (const item of result.data) {
      const card = node('article', null, 'item');
      card.append(node('strong', item.title),
        node('p', (labels[item.latest_review_decision] || 'Bản nháp') + ' · ' +
          (item.publication_status === 'published' ? 'Đang xuất bản' : 'Chưa xuất bản') + ' · Phiên bản ' + item.latest_version_number),
        button('Xem tài liệu', () => perform(null, status, async () => {
          await openResource(item.id);
          status.textContent = '';
        })));
      list.append(card);
    }
    if (!result.data.length) list.append(node('p', 'Chưa có tài liệu.'));
    list.append(pager(result.pagination, target => perform(null, status, async () => {
      await loadResources(target);
      status.textContent = '';
    })));
  }

  async function openResource(id) {
    const [data, reviews] = await Promise.all([request('/teacher/resources/' + id), request('/teacher/resources/' + id + '/reviews')]);
    const notes = new Map(reviews.map(review => [review.version_id, review.review_note]));
    detail.replaceChildren(node('h2', 'Chi tiết tài liệu'),
      details([['Phạm vi', data.school_name || 'Đóng góp độc lập'], ['Published Version', data.published_version_id ?? 'Chưa xuất bản']]));
    const canCopy = !data.versions.some(version => version.edit_state === 'draft' || version.decision === 'pending');
    for (const version of data.versions) {
      const card = node('article', null, 'item');
      card.append(node('h3', 'Phiên bản ' + version.version_number + ' · ' + (labels[version.decision || version.edit_state] || 'Đã gửi')),
        node('p', version.title));
      if (version.published) card.append(node('p', 'Đang xuất bản'));
      if (notes.get(version.id)) card.append(node('p', 'Nhận xét: ' + notes.get(version.id)));
      if (version.edit_state === 'draft') {
        card.append(form(metadataFields(version), 'Lưu bản nháp', async body => {
          await request('/teacher/versions/' + version.id, { method: 'PATCH', body: metadata(body) });
          await openResource(id);
          status.textContent = 'Đã lưu bản nháp.';
        }, status));
        if (version.resource_type !== 'external_link') {
          const uploadField = field('Tệp PDF', 'file', { type: 'file' });
          uploadField.querySelector('input').accept = 'application/pdf,.pdf';
          card.append(form([uploadField], 'Tải PDF lên', async (_body, uploadForm) => {
            const file = uploadForm.elements.file.files[0];
            if (!file || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Vui lòng chọn tệp PDF.');
            const upload = new FormData();
            upload.append('file', file);
            await request('/teacher/versions/' + version.id + '/upload', { method: 'POST', body: upload });
            await openResource(id);
            status.textContent = 'Đã tải tệp PDF.';
          }, status));
          if (version.has_file) card.append(node('p', 'Đã có tệp PDF.'));
        }
        const submit = button('Gửi duyệt', () => perform(submit, status, async () => {
          await request('/teacher/versions/' + version.id + '/submit', { method: 'POST' });
          await Promise.all([openResource(id), loadResources()]);
          status.textContent = 'Đã gửi duyệt. Phiên bản đang chờ xử lý.';
        }), 'button primary');
        card.append(submit);
      } else if (canCopy) {
        const copy = button('Tạo phiên bản mới', () => perform(copy, status, async () => {
          await request('/teacher/resources/' + id + '/versions', { method: 'POST', body: { source_version_id: version.id } });
          await openResource(id);
          status.textContent = 'Đã tạo phiên bản mới.';
        }));
        card.append(copy);
      }
      detail.append(card);
    }
  }

  (async () => {
    const user = await bridge.guard('teacher');
    if (!user) return;
    const profile = await request('/teacher/profile');
    document.querySelector('#teacher-profile').textContent = profile.full_name + ' · ' + profile.email;
    const logout = document.querySelector('#logout');
    bridge.logout(logout, status);
    logout.hidden = false;
    document.querySelector('main').hidden = false;
    guardStatus.hidden = true;
    catalog.append(node('h2', 'Tài liệu của tôi'), node('div', null, 'resource-list'));
    status.textContent = 'Đang tải dữ liệu…';
    await Promise.all([loadSchools(), loadResources()]);
    renderCreate();
    status.textContent = '';
  })().catch(error => {
    guardStatus.hidden = false;
    guardStatus.textContent = error.message;
  });
})();
