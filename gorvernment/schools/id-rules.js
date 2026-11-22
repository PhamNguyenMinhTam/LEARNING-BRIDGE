"use strict";

const renderRules = (() => {
  let selectedSchool = state.schools[0]?.code || "";

  function matchesRule(rule, sample) {
    const digits = (value, count) => /^\d+$/.test(value) && (!count || value.length === Number(count));
    if (!sample.startsWith(rule.prefix)) return false;
    const body = sample.slice(rule.prefix.length);
    if (rule.type === "alphanumeric") {
      return /^[a-z0-9]+$/i.test(body) && (!rule.digits || body.length === Number(rule.digits));
    }
    if (rule.type === "custom") {
      const split = Number(rule.digits);
      return digits(body.slice(0, split), rule.digits) &&
        body.slice(split, split + rule.separator.length) === rule.separator &&
        digits(body.slice(split + rule.separator.length), rule.suffix);
    }
    return digits(body, rule.digits);
  }

  function editRule(code) {
    const rule = state.rules[code] || {};
    const form = formFor([
      field("school-name", "Trường", schoolName(code), { readOnly: true }),
      field("type", "Loại quy tắc", rule.type || "numeric", { choices: Object.entries(ruleTypes), required: true }),
      field("prefix", "Tiền tố", rule.prefix, { maxLength: 20 }),
      field("digits", "Số chữ số", rule.digits, { type: "number", min: 1, max: 40 }),
      field("separator", "Dấu phân cách", rule.separator, { maxLength: 4 }),
      field("suffix", "Số chữ số nhóm sau", rule.suffix, { type: "number", min: 1, max: 40 }),
      field("example", "Mã ví dụ", rule.example, { required: true, maxLength: 120 }),
      field("description", "Mô tả", rule.description, { multiline: true, maxLength: 500 })
    ], "Lưu quy tắc", (values, fail) => {
      const { type, example, description } = values;
      const config = { type, example, description, prefix: values.prefix || "", digits: values.digits || "",
        separator: values.separator || "", suffix: values.suffix || "" };
      if (!matchesRule(config, example)) {
        fail("example", "Mã ví dụ chưa khớp cấu hình.");
        return;
      }
      confirmAction("Lưu quy tắc mã giáo viên", `Áp dụng quy tắc cho ${schoolName(code)}?`, () => {
        state.rules[code] = config;
        finish("Đã cập nhật quy tắc mã giáo viên.", "rule-school");
      });
    });
    const controls = form.elements;
    function configure() {
      const type = controls.namedItem("type").value;
      const settings = [
        ["prefix", type !== "numeric", type === "prefix", "Tiền tố"],
        ["digits", true, type !== "alphanumeric", type === "alphanumeric" ? "Số ký tự sau tiền tố" : "Số chữ số nhóm đầu"],
        ["separator", type === "custom", true, "Dấu phân cách"],
        ["suffix", type === "custom", true, "Số chữ số nhóm sau"]
      ];
      for (const [name, enabled, required, label] of settings) {
        const input = controls.namedItem(name);
        input.disabled = !enabled;
        input.required = enabled && required;
        const wrapper = input.closest(".field");
        wrapper.hidden = !enabled;
        wrapper.querySelector("label").textContent = label + (input.required ? " *" : "");
        if (form.isConnected) fieldError(input, "");
      }
    }
    controls.namedItem("type").addEventListener("change", configure);
    configure();
    openDetails("Chỉnh sửa quy tắc", element("p", "rule-warning",
      "Thay đổi quy tắc định dạng có thể ảnh hưởng đến việc đăng ký tài khoản mới. Các tài khoản hiện có không được tự động sửa đổi."), form);
  }

  function rules(content) {
    const selection = field("school", "Chọn trường", selectedSchool, { id: "rule-school", choices: schoolChoices() });
    const current = group("card stack");
    function update() {
      const rule = state.rules[selectedSchool];
      current.replaceChildren(element("h2", "", "Quy tắc hiện tại"));
      if (rule) {
        current.append(details([
          ["Loại quy tắc", ruleTypes[rule.type]], ["Tiền tố", rule.prefix],
          [rule.type === "alphanumeric" ? "Số ký tự sau tiền tố" : "Số chữ số nhóm đầu", rule.digits],
          ["Dấu phân cách", rule.separator], ["Số chữ số nhóm sau", rule.suffix],
          ["Mã ví dụ", rule.example], ["Mô tả", rule.description]
        ]));
      } else current.append(element("p", "muted", "Trường này chưa có quy tắc."));
      current.append(group("actions", button(rule ? "Sửa quy tắc" : "Thêm quy tắc", () => editRule(selectedSchool), "primary")));
      if (!rule) return;
      const result = element("p");
      result.setAttribute("role", "status");
      const sample = field("sample", "Nhập mã giáo viên để kiểm tra", "", { required: true, maxLength: 120 });
      sample.querySelector("input").addEventListener("input", () => { result.textContent = ""; });
      const form = formFor([sample], "Kiểm tra định dạng", (values, fail) => {
        if (!matchesRule(rule, values.sample)) {
          fail("sample", "Mã không khớp với quy tắc.");
          return;
        }
        result.className = "success";
        result.textContent = "Mã khớp định dạng.";
      });
      current.append(form, result, element("p", "muted", "Kết quả chỉ phản ánh định dạng của mã. Danh tính giáo viên cần được xác minh riêng."));
    }
    selection.querySelector("select").addEventListener("change", event => {
      selectedSchool = event.target.value;
      update();
    });
    const rows = sortRecords(state.schools, "name", "name").map(school => {
      const rule = state.rules[school.code];
      return [school.code, school.name, rule ? ruleTypes[rule.type] : "Chưa cấu hình", rule?.example || "—"];
    });
    content.append(group("card", selection), current,
      table("Định dạng mã theo trường", ["Mã trường", "Tên trường", "Loại quy tắc", "Mã ví dụ"], rows));
    update();
  }

  return rules;
})();
