"use strict";

const renderOverview = (() => {
  function preview(heading, records, display, actionLabel, route) {
    const list = element("ul", "preview");
    for (const record of records.slice(0, 5)) {
      const item = element("li");
      item.append(element("span", "", display(record)), element("time", "muted", dateLabel(record.date)));
      list.append(item);
    }
    return group("card", element("h2", "", heading),
      records.length ? list : element("p", "muted", "Chưa có bản ghi."),
      link(actionLabel, route));
  }

  function overview(content) {
    const pending = state.resources.filter(resource => resource.status === "pending");
    const stats = [
      ["Tổng số trường", state.schools.length, "#schools"],
      ["Trường hoạt động", state.schools.filter(school => school.status === "active").length, "#schools"],
      ["Trường ngừng hoạt động", state.schools.filter(school => school.status === "inactive").length, "#schools"],
      ["Tài khoản School", state.accounts.length, "#accounts"],
      ["Tài liệu chờ duyệt", pending.length, "#reviews"],
      ["Tài liệu đã duyệt", state.resources.filter(resource => resource.status === "approved").length, "#reviews"]
    ];
    const summary = group("stats", ...stats.map(([label, count, route]) => {
      const card = link(label, route, "card stat");
      card.append(element("strong", "", count));
      return card;
    }));
    content.append(summary, group("panels",
      preview("Trường được thêm gần đây", sortRecords(state.schools, "newest", "name"),
        school => school.name, "Mở quản lý trường", "#schools"),
      preview("Tài liệu đang chờ duyệt", sortRecords(pending, "newest", "title"),
        resource => resource.title, "Mở danh sách kiểm duyệt", "#reviews")));
  }

  return overview;
})();
