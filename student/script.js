(() => {
  const { request, url } = bridge;
  const { node, field, button, pager, external } = bridgeUI;
  const get = id => document.getElementById(id);
  const filter = get('filter-form');
  const filterDialog = get('filter-dialog');
  const dialog = get('resource-dialog');
  const results = get('resources');
  const count = get('result-count');
  const typeLabels = { pdf: 'PDF', external_link: 'Liên kết ngoài', authored_document: 'Tài liệu biên soạn' };
  const state = { search: '', filters: {}, page: 1, sort: 'newest' };
  let searchRequest;
  let detailRequest;
  let timer;

  const icons = {
  search: "M21 21l-4.4-4.4 M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  book: "M12 6v15 M12 6C8 3 4 4 2 5v14c3-1 7-1 10 2 3-3 7-3 10-2V5c-2-1-6-2-10 1Z",
  school: "M3 21h18 M5 21V9l7-5 7 5v12 M9 21v-6h6v6 M12 8v2",
  cap: "M2 9l10-5 10 5-10 5-10-5Z M6 11v6c4 3 8 3 12 0v-6 M22 9v8",
  research: "M9 3h6 M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3 M7 15h10",
  code: "M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 4l-4 16",
  file: "M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6",
  slides: "M2 4h20v13H2z M12 17v4 M8 21h8 M6 13l4-4 3 2 4-4",
  pencil: "M4 16L16 4l4 4-12 12-5 1z M14 6l4 4",
  arrow: "M5 12h14 M13 6l6 6-6 6"
};
  function icon(name) {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('d', icons[name]);
    svg.append(path);
    return svg;
  }

  function metadata(entries) {
    const list = node('dl', null, 'metadata');
    for (const [key, value] of entries) {
      const item = node('div');
      item.append(node('dt', key), node('dd', value));
      list.append(item);
    }
    return list;
  }

  async function openResource(id) {
    detailRequest?.abort();
    const controller = new AbortController();
    detailRequest = controller;
    const title = node('h2', 'Đang tải chi tiết…');
    title.id = 'detail-title';
    const body = get('detail-content');
    body.replaceChildren(title);
    if (!dialog.open) dialog.showModal();
    try {
      const record = await request('/public/resources/' + id, { guest: true, signal: controller.signal });
      title.textContent = record.title;
      body.append(node('p', record.description, 'description'), metadata([
        ['Tác giả', record.author_name], ['Danh mục', record.category], ['Cấp học', record.education_level],
        ['Phiên bản', record.version_number], ['Quyền phân phối', record.rights_basis]
      ]));
      if (record.access_methods.includes('download')) {
        const download = node('a', 'Tải PDF', 'primary');
        download.href = url('/public/resources/' + id + '/download');
        const preview = node('a', 'Xem trước PDF', 'secondary');
        preview.href = url('/public/resources/' + id + '/preview');
        preview.target = '_blank';
        preview.rel = 'noopener noreferrer';
        body.append(download, ' ', preview);
      }
      if (record.access_methods.includes('external')) {
        const show = button('Lấy liên kết ngoài', async () => {
          show.disabled = true;
          const feedback = node('p', 'Đang xác nhận liên kết…', 'access-note');
          feedback.setAttribute('role', 'status');
          show.after(feedback);
          try {
            const destination = await request('/public/resources/' + id + '/external-link',
              { guest: true, signal: controller.signal });
            feedback.replaceChildren(external(destination.url));
            show.remove();
          } catch (error) {
            if (error.name !== 'AbortError') feedback.textContent = error.message;
            show.disabled = false;
          }
        }, 'secondary');
        body.append(node('p', 'Tài liệu mở trên trang web bên thứ ba.', 'access-note'), show);
      }
      if (record.access_methods.includes('source_link')) body.append(external(record.source_url));
    } catch (error) {
      if (error.name !== 'AbortError') title.textContent = error.message;
    }
  }

  function card(record) {
    const article = node('article', null, 'resource-card');
    const top = node('div', null, 'resource-top');
    const symbol = node('span', null, 'tile-icon');
    symbol.append(icon(record.resource_type === 'pdf' ? 'file' : 'book'));
    top.append(symbol, node('span', typeLabels[record.resource_type], 'type-label'));
    const more = button('Xem chi tiết', () => openResource(record.id), 'text-button details-button');
    more.setAttribute('aria-label', 'Xem chi tiết ' + record.title);
    more.append(icon('arrow'));
    article.append(top, node('h3', record.title), node('p', record.description, 'description'),
      metadata([['Tác giả', record.author_name], ['Danh mục', record.category], ['Cấp học', record.education_level]]), more);
    return article;
  }

  function chips() {
    const active = get('active-filters');
    active.replaceChildren();
    if (state.search) active.append(button('Đặt lại tìm kiếm ×', () => { get('query').value = ''; search(); }, 'chip'));
    for (const [key, value] of Object.entries(state.filters)) {
      if (!value) continue;
      active.append(button((typeLabels[value] || value) + ' ×', () => {
        filter.elements[key].value = '';
        apply();
      }, 'chip'));
    }
  }

  async function render() {
    searchRequest?.abort();
    const controller = new AbortController();
    searchRequest = controller;
    count.textContent = 'Đang tìm tài liệu…';
    results.replaceChildren();
    get('pagination').replaceChildren();
    chips();
    try {
      const data = await request('/public/resources', {
        query: { search: state.search, ...state.filters, sort: state.sort, page: state.page, limit: 6 },
        guest: true, signal: controller.signal
      });
      if (controller.signal.aborted) return;
      count.textContent = data.pagination.total + ' tài liệu';
      if (data.data.length) results.replaceChildren(...data.data.map(card));
      else results.replaceChildren(node('p', 'Không tìm thấy tài liệu phù hợp.', 'empty-state'));
      get('pagination').append(pager(data.pagination, page => { state.page = page; render(); }));
    } catch (error) {
      if (error.name !== 'AbortError') count.textContent = error.message;
    }
  }

  async function filters() {
    const fields = get('filter-fields');
    fields.textContent = 'Đang tải bộ lọc…';
    try {
      const values = await request('/public/filters', { guest: true });
      fields.replaceChildren(...[
        ['Danh mục', 'category', values.categories],
        ['Cấp học', 'education_level', values.education_levels],
        ['Loại tài liệu', 'resource_type', values.resource_types.map(type => [type, typeLabels[type]])]
      ].map(([label, key, options]) => {
        const control = field(label, key, { values: [['', 'Tất cả'], ...options], required: false });
        control.className = 'filter-field';
        return control;
      }));
      const categories = get('categories');
      categories.replaceChildren();
      if (!values.education_levels.length) categories.append(node('p', 'Chưa có tài liệu theo bậc học.'));
      for (const level of values.education_levels) {
        const category = button(level, () => {
          filter.elements.education_level.value = level;
          apply();
          get('results-title').focus();
        }, 'category');
        const symbol = node('span', null, 'tile-icon');
        symbol.append(icon('cap'));
        category.prepend(symbol);
        categories.append(category);
      }
    } catch (error) { fields.textContent = error.message; }
  }

  function search() {
    clearTimeout(timer);
    state.search = get('query').value.trim();
    get('clear-query').hidden = !state.search;
    state.page = 1;
    render();
  }
  function apply() {
    state.filters = Object.fromEntries(new FormData(filter));
    state.page = 1;
    render();
  }

  for (const slot of document.querySelectorAll('[data-icon]')) {
    if (icons[slot.dataset.icon]) slot.append(icon(slot.dataset.icon));
  }
  get('query').maxLength = 100;
  get('query').addEventListener('input', () => {
    clearTimeout(timer);
    get('clear-query').hidden = !get('query').value;
    timer = setTimeout(search, 350);
  });
  get('search-form').addEventListener('submit', event => {
    event.preventDefault();
    search();
    get('results-title').focus();
  });
  get('clear-query').addEventListener('click', () => { get('query').value = ''; search(); get('query').focus(); });
  get('sort').addEventListener('change', () => { state.sort = get('sort').value; state.page = 1; render(); });
  filter.addEventListener('change', () => { if (!filterDialog.open) apply(); });
  filter.addEventListener('submit', event => { event.preventDefault(); apply(); if (filterDialog.open) filterDialog.close(); });
  get('clear-filters').addEventListener('click', () => { filter.reset(); if (!filterDialog.open) apply(); });
  get('open-filters').addEventListener('click', () => { filterDialog.append(filter); filterDialog.showModal(); });
  get('close-filters').addEventListener('click', () => filterDialog.close());
  filterDialog.addEventListener('close', () => {
    get('filter-sidebar').append(filter);
    for (const control of filter.querySelectorAll('select')) control.value = state.filters[control.name] || '';
  });
  matchMedia('(max-width: 760px)').addEventListener('change', event => {
    if (!event.matches && filterDialog.open) filterDialog.close();
  });
  dialog.addEventListener('close', () => detailRequest?.abort());
  const menu = get('menu-toggle');
  menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(menu.getAttribute('aria-expanded') !== 'true')));
  get('navigation').addEventListener('click', () => menu.setAttribute('aria-expanded', 'false'));
  filters();
  render();
})();
