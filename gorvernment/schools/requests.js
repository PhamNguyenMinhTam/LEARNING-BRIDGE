"use strict";

const renderSchools = (() => {
  const filters = { search: "", type: "", status: "", sort: "newest" };

  function schoolDetails(school) {
    const rule = state.rules[school.code];
    const accounts = state.accounts.filter(account => account.school === school.code);
    openDetails(school.name, details([
      ["Mã trường", school.code], ["Loại cơ sở", school.type], ["Email", school.email],
      ["Điện thoại", school.phone], ["Trạng thái", badge(school.status)], ["Ngày tạo", dateLabel(school.date)],
      ["Quy tắc mã giáo viên", rule ? `${ruleTypes[rule.type]} · ${rule.example}` : "Chưa cấu hình"],
      ["Tài khoản School", `${accounts.length} tài khoản · ${accounts.filter(account => account.status === "active").length} hoạt động`]
    ]));
  }

  function editSchool(school) {
    const form = formFor([
      field("name", "Tên trường", school?.name, { required: true, maxLength: 150 }),
      field("code", "Mã trường", school?.code, { required: true, readOnly: Boolean(school), maxLength: 30 }),
      field("type", "Loại cơ sở giáo dục", school?.type || institutionTypes[0], { choices: institutionTypes, required: true }),
      field("email", "Email liên hệ", school?.email, { type: "email" }),
      field("phone", "Điện thoại liên hệ", school?.phone, { type: "tel", maxLength: 35 }),
      field("status", "Trạng thái", school?.status || "active", { choices: statusOptions(["active", "inactive"]), required: true })
    ], "Lưu bản ghi", (values, fail) => {
      const code = values.code.toUpperCase();
      if (!school && state.schools.some(item => item.code === code)) {
        fail("code", "Mã trường đã tồn tại.");
        return;
      }
      const save = () => {
        if (school) Object.assign(school, values);
        else state.schools.unshift({ ...values, code, date: today() });
        finish(school ? "Đã cập nhật bản ghi trường." : "Đã thêm bản ghi trường.", "add-school");
      };
      if (school && school.status !== values.status) {
        confirmAction("Đổi trạng thái trường", `Chuyển ${school.name} sang trạng thái “${statusLabels[values.status]}”?`, save, values.status === "inactive");
      } else save();
    });
    form.classList.add("school-form");
    openDetails(school ? "Chỉnh sửa trường" : "Thêm trường đã xác minh", form);
  }

  function schools(content) {
    const results = group("stack");
    const add = button("Thêm trường", () => editSchool(), "primary");
    add.id = "add-school";
    function update() {
      const records = filtered(state.schools, filters, ["name", "code"], "name");
      results.replaceChildren(table("Danh sách trường", ["Mã trường", "Tên trường", "Loại cơ sở", "Liên hệ", "Trạng thái", "Ngày tạo", "Thao tác"],
        records.map(school => [
          school.code, school.name, school.type, [school.email, school.phone].filter(Boolean).join(" · ") || "—",
          badge(school.status), dateLabel(school.date), group("actions",
            button("Chi tiết", () => schoolDetails(school)),
            button("Sửa", () => editSchool(school)),
            button(school.status === "active" ? "Ngừng hoạt động" : "Kích hoạt",
              () => toggleStatus(school, school.name, "add-school"))
          )
        ])));
    }
    content.append(group("actions", add),
      filterBar(filters, "Tìm theo tên hoặc mã trường", institutionTypes, ["active", "inactive"], "Tên A–Z", update), results);
    update();
  }

  return schools;
})();
