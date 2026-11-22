"use strict";

const renderAccounts = (() => {
  function createAccount() {
    openDetails("Thêm bản ghi tài khoản School", formFor([
      field("school", "Trường", "", { choices: [["", "Chọn trường"], ...schoolChoices()], required: true }),
      field("username", "Tên tài khoản", "", { required: true, maxLength: 60 }),
      field("role", "Vai trò", role, { readOnly: true }),
      field("status", "Trạng thái", "active", { choices: statusOptions(["active", "inactive"]), required: true })
    ], "Tiếp tục", ({ school, username, status }, fail) => {
      if (state.accounts.some(account => account.username.toLowerCase() === username.toLowerCase())) {
        fail("username", "Tên tài khoản đã tồn tại.");
        return;
      }
      confirmAction("Thêm bản ghi tài khoản", `Thêm bản ghi “${username}” cho ${schoolName(school)}?`, () => {
        state.accounts.unshift({ school, username, status, date: today() });
        finish("Đã thêm bản ghi tài khoản School.", "add-account");
      });
    }));
  }

  function accounts(content) {
    const add = button("Thêm bản ghi tài khoản", createAccount, "primary");
    add.id = "add-account";
    const rows = sortRecords(state.accounts, "newest", "username").map(account => {
      const profile = [
        ["Tên trường", schoolName(account.school)], ["Tên tài khoản", account.username],
        ["Vai trò", role], ["Trạng thái", statusLabels[account.status]], ["Ngày tạo", dateLabel(account.date)]
      ];
      return [...profile.map(([label, value]) => label === "Trạng thái" ? badge(account.status) : value), group("actions",
        button("Chi tiết", () => openDetails("Chi tiết tài khoản School", details(profile))),
        button(account.status === "active" ? "Ngừng hoạt động" : "Kích hoạt",
          () => toggleStatus(account, account.username, "add-account"))
      )];
    });
    content.append(group("actions", add),
      table("Danh sách tài khoản School", ["Tên trường", "Tên tài khoản", "Vai trò", "Trạng thái", "Ngày tạo", "Thao tác"], rows));
  }

  return accounts;
})();
