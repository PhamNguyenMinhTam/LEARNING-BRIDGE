"use strict";

const renderReviews = (() => {
  const filters = { search: "", type: "", status: "", sort: "newest" };

  function reviewDetails(resource) {
    const body = group("stack", details([
      ["Mô tả", resource.description], ["Người đóng góp", resource.contributor],
      ["Môn / lĩnh vực", resource.subject], ["Chủ đề", resource.topics.join(" · ")],
      ["Loại tài liệu", resource.type], ["Ngày gửi", dateLabel(resource.date)],
      ["Nguồn", resource.source], ["Quyền sử dụng", resource.rights], ["Trạng thái", badge(resource.status)]
    ]), element("p", "card muted", "Chưa có bản xem trước tài liệu."));
    if (resource.status !== "pending") {
      body.append(details([["Ngày quyết định", dateLabel(resource.reviewed)], ["Ghi chú kiểm duyệt", resource.note]]));
      openDetails(resource.title, body);
      return;
    }
    const noteField = field("note", "Ghi chú kiểm duyệt", "", { multiline: true, maxLength: 1000 });
    const note = noteField.querySelector("textarea");
    function decide(status) {
      const message = note.value.trim();
      if (status === "rejected" && !message) {
        fieldError(note, "Vui lòng nhập lý do từ chối.");
        note.focus();
        return;
      }
      const action = status === "approved" ? "Duyệt tài liệu" : "Từ chối tài liệu";
      confirmAction(action, `${action} “${resource.title}” trong bản demo?`, () => {
        Object.assign(resource, { status, note: message, reviewed: today() });
        finish("Đã ghi nhận quyết định kiểm duyệt.", "field-search");
      }, status === "rejected");
    }
    body.append(noteField, group("actions",
      button("Duyệt", () => decide("approved"), "primary"),
      button("Từ chối", () => decide("rejected"), "danger")));
    openDetails(resource.title, body);
  }

  function reviews(content) {
    const results = group("stack");
    function update() {
      const records = filtered(state.resources, filters, ["title", "contributor", "subject"], "title");
      results.replaceChildren(table("Danh sách tài liệu độc lập", ["Tên tài liệu", "Người đóng góp", "Môn / lĩnh vực", "Loại", "Ngày gửi", "Trạng thái", "Thao tác"],
        records.map(resource => [
          resource.title, resource.contributor, resource.subject, resource.type, dateLabel(resource.date),
          badge(resource.status), group("actions", button("Chi tiết", () => reviewDetails(resource)))
        ])));
    }
    content.append(filterBar(filters, "Tìm tên, người đóng góp hoặc môn", resourceTypes,
      ["pending", "approved", "rejected"], "Tiêu đề A–Z", update), results);
    update();
  }

  return reviews;
})();
