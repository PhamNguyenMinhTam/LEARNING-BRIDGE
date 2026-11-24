(() => {
  const { request, url } = bridge;
  const { node, button, perform, pager, date } = bridgeUI;
  const get = id => document.getElementById(id);
  const status = get('review-status');
  const dialog = get('review-dialog');
  const confirmation = get('confirm-dialog');
  const states = { pending: 'Chờ duyệt', approved: 'Đã chấp thuận', rejected: 'Đã từ chối' };
  let pendingPage = 1;
  let historyPage = 1;
  let selected;
  let decision;
  let refreshSequence = 0;

  async function refresh() {
    const sequence = ++refreshSequence;
    const profile = await request('/school/profile');
    const suspended = profile.school.status === 'suspended';
    const queueStatus = get('status-filter').value;
    const queueQuery = { page: pendingPage, limit: 12, search: get('search').value.trim(),
      from: get('filter-from').value, to: get('filter-to').value };
    const historyQuery = { page: historyPage, limit: 12, decision: get('history-filter').value };
    const queue = (queueStatus === 'pending' && suspended) ? Promise.resolve(null)
      : request('/school/reviews/' + (queueStatus === 'pending' ? 'pending' : 'history'), {
        query: queueStatus === 'pending' ? queueQuery : { ...queueQuery, decision: queueStatus }
      });
    const [results, history, approved, rejected, pending] = await Promise.all([
      queue, request('/school/reviews/history', { query: historyQuery }),
      request('/school/reviews/history', { query: { decision: 'approved', limit: 1 } }),
      request('/school/reviews/history', { query: { decision: 'rejected', limit: 1 } }),
      suspended ? Promise.resolve(null) : request('/school/reviews/pending', { query: { limit: 1 } })
    ]);
    if (sequence !== refreshSequence) return;
    get('school-profile').textContent = profile.school.school_name + ' · ' + profile.full_name;
    status.textContent = suspended ? 'Trường đang bị đình chỉ. Bạn vẫn có thể xem lịch sử.' : '';
    get('pending-count').textContent = pending?.pagination.total ?? '—';
    get('approved-count').textContent = approved.pagination.total;
    get('rejected-count').textContent = rejected.pagination.total;
    get('result-count').textContent = results ? results.pagination.total + ' tài liệu' : 'Hàng chờ tạm thời không khả dụng.';
    get('resources').replaceChildren();
    for (const record of results?.data || []) {
      const tr = node('tr');
      for (const [label, value] of [
        ['Tài liệu', record.title + ' · V' + record.version_number], ['Môn học', record.category], ['Loại', record.resource_type],
        ['Ngày gửi', date(record.submitted_at)], ['Trạng thái', states[record.decision]]
      ]) {
        const td = node('td');
        if (label === 'Tài liệu') td.append(node('span', value, 'resource-title'), node('small', record.owner_name));
        else if (label === 'Trạng thái') td.append(node('span', value, 'badge ' + record.decision));
        else td.textContent = value ?? '—';
        td.dataset.label = label;
        tr.append(td);
      }
      const action = node('td', null, 'row-actions');
      action.append(button('Xem chi tiết', () => open(record.review_id)));
      tr.append(action);
      get('resources').append(tr);
    }
    get('empty').hidden = !results || results.data.length > 0;
    get('queue-pages').replaceChildren(...(results ? [pager(results.pagination, page => {
      pendingPage = page;
      reload();
    })] : []));
    get('history-list').replaceChildren(...history.data.map(row => {
      const li = node('li');
      li.append(node('strong', row.title), node('p', states[row.decision] + ' · ' + date(row.reviewed_at)),
        button('Xem lịch sử ' + row.title, () => open(row.review_id)));
      return li;
    }));
    get('history-empty').hidden = history.data.length > 0;
    get('history-pages').replaceChildren(pager(history.pagination, page => {
      historyPage = page;
      reload();
    }));
  }

  function reload() {
    get('result-count').textContent = 'Đang tải…';
    return refresh().catch(error => { status.textContent = error.message; });
  }

  async function open(id) {
    selected = null;
    get('detail-title').textContent = 'Đang tải chi tiết…';
    get('metadata').replaceChildren();
    get('decision-fields').hidden = true;
    get('past-decision').hidden = true;
    get('detail-status').textContent = '';
    get('review-note').value = '';
    get('note-error').textContent = '';
    if (!dialog.open) dialog.showModal();
    try {
      const record = await request('/school/reviews/' + id);
      if (!dialog.open) return;
      selected = record;
      get('detail-title').textContent = record.title;
      get('detail-status').textContent = states[record.decision];
      for (const [label, value] of [['Phiên bản', record.version_number], ['Tác giả', record.author_name],
        ['Mô tả', record.description], ['Loại tài liệu', record.resource_type], ['Quyền phân phối', record.rights_basis],
        ['Truy cập', record.access_level], ['Ngày gửi', date(record.submitted_at)]]) {
        get('metadata').append(node('dt', label), node('dd', value));
      }
      if (record.has_file || record.source_url) {
        const target = node('dd');
        if (record.has_file) {
          const file = node('a', 'Tải PDF để kiểm tra');
          file.href = url('/school/reviews/' + id + '/preview');
          target.append(file);
        }
        if (record.source_url) {
          try { target.append(bridgeUI.external(record.source_url)); }
          catch { target.append(node('span', 'URL nguồn không hợp lệ.')); }
        }
        get('metadata').append(node('dt', 'Nội dung'), target);
      }
      get('decision-fields').hidden = record.decision !== 'pending';
      if (record.decision !== 'pending') {
        get('past-decision').hidden = false;
        get('past-decision').textContent = record.review_note || 'Không có ghi chú.';
      }
    } catch (error) {
      get('detail-status').textContent = error.message;
    }
  }

  function confirm(next) {
    if (!selected) return;
    const note = get('review-note').value.trim();
    if (next === 'reject' && !note) {
      get('note-error').textContent = 'Vui lòng nhập lý do từ chối.';
      get('review-note').focus();
      return;
    }
    decision = { id: selected.review_id, next, body: note ? { note } : {} };
    get('confirm-message').textContent = next === 'approve' ? 'Chấp thuận phiên bản này?' : 'Từ chối phiên bản này?';
    confirmation.showModal();
  }

  get('approve').addEventListener('click', () => confirm('approve'));
  get('reject').addEventListener('click', () => confirm('reject'));
  get('close-review').addEventListener('click', () => dialog.close());
  get('confirm-action').addEventListener('click', event => {
    event.preventDefault();
    const current = decision;
    perform(get('confirm-action'), get('confirm-message'), async () => {
      try {
        const result = await request('/school/reviews/' + current.id + '/' + current.next, {
          method: 'POST', body: current.body
        });
        confirmation.close();
        dialog.close();
        pendingPage = 1;
        await reload();
        status.textContent = states[result.decision] + (result.publication_occurred
          ? ' và đã xuất bản.' : ' · Trạng thái xuất bản: ' + (result.publication_status === 'published' ? 'đang xuất bản.' : 'đang ẩn.'));
      } catch (error) {
        if (error.status !== 409) throw error;
        confirmation.close();
        dialog.close();
        await reload();
        status.textContent = error.message;
      }
    });
  });
  let timer;
  get('search').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { pendingPage = 1; reload(); }, 300);
  });
  get('filters').addEventListener('submit', event => { event.preventDefault(); pendingPage = 1; reload(); });
  for (const id of ['status-filter', 'filter-from', 'filter-to']) {
    get(id).addEventListener('change', () => { pendingPage = 1; reload(); });
  }
  get('history-filter').addEventListener('change', () => { historyPage = 1; reload(); });
  get('clear-filters').addEventListener('click', () => { get('filters').reset(); pendingPage = 1; reload(); });
  (async () => {
    if (!await bridge.guard('school_admin')) return;
    bridge.logout(get('logout'), status);
    document.querySelector('.dashboard').hidden = false;
    get('guard-status').hidden = true;
    await reload();
  })().catch(error => { get('guard-status').textContent = error.message; });
})();
