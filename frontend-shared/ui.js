(() => {
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function button(label, handler, className = 'button') {
    const control = node('button', label, className);
    control.type = 'button';
    if (handler) control.addEventListener('click', handler);
    return control;
  }

  let fieldId = 0;
  function field(label, name, { type = 'text', values, required = true, value = '', maxLength } = {}) {
    const wrapper = node('div', null, 'field');
    const caption = node('label', label);
    const control = node(values ? 'select' : type === 'textarea' ? 'textarea' : 'input');
    control.name = name;
    control.id = 'bridge-field-' + ++fieldId;
    caption.htmlFor = control.id;
    if (values) {
      for (const option of values) {
        const [key, caption] = Array.isArray(option) ? option : [option, option];
        control.append(new Option(caption, key));
      }
    } else if (type !== 'textarea') control.type = type;
    if (type === 'password') control.autocomplete = 'new-password';
    if (maxLength) control.maxLength = maxLength;
    control.required = required;
    control.value = value;
    wrapper.append(caption, control);
    return wrapper;
  }

  function form(fields, label, handler, status, className = 'stack') {
    const form = node('form', null, className);
    const submit = node('button', label, 'button primary');
    submit.type = 'submit';
    form.append(...fields, submit);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      perform(submit, status, () => handler(values, form));
    });
    return form;
  }

  async function perform(control, status, work) {
    if (control?.disabled) return;
    if (control) control.disabled = true;
    status.textContent = 'Đang xử lý…';
    try {
      await work();
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = error.message;
    } finally {
      if (control) control.disabled = false;
    }
  }

  function pager(pagination, move) {
    const wrap = node('div', null, 'actions pager');
    const last = pagination.total_pages ?? Math.ceil(pagination.total / pagination.limit);
    if (last <= 1) return wrap;
    const prev = button('Trang trước', () => move(pagination.page - 1));
    const next = button('Trang sau', () => move(pagination.page + 1));
    prev.disabled = pagination.page <= 1;
    next.disabled = pagination.page >= last;
    wrap.append(prev, node('span', 'Trang ' + pagination.page + '/' + last), next);
    return wrap;
  }

  function external(url, label = 'Mở trang web bên thứ ba') {
    const destination = new URL(url);
    if (destination.protocol !== 'https:' || destination.username || destination.password) {
      throw new Error('Liên kết ngoài không hợp lệ.');
    }
    const link = node('a', label, 'button');
    link.href = destination.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function details(entries) {
    const list = node('dl');
    for (const [label, value] of entries) list.append(node('dt', label), node('dd', value ?? '—'));
    return list;
  }

  const date = value => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value)) : '—';
  window.bridgeUI = { node, button, field, form, perform, pager, external, details, date };
})();
