const { test, expect } = require('@playwright/test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createServer } = require('node:net');
const { readFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { loadConfig } = require('../../src/config/env');
const { createDatabasePool } = require('../../src/config/database');
const { createUserRepository } = require('../../src/repositories/user.repository');
const { hashPassword } = require('../../src/services/credentials');
const { pdf } = require('../fixtures/teacher-pdf');

const password = randomUUID() + '🔑';
const tag = randomUUID().slice(0, 8);

async function login(page, path, email) {
  await page.goto(path);
  await page.getByLabel(/Email/).fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page.locator('#logout')).toBeVisible();
}

async function register(page, email) {
  await page.goto('/teacher/auth/register.html');
  await page.locator('#full-name').fill('Teacher ' + tag);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirm-password').fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/registered=1/);
  await login(page, '/teacher/auth/login.html', email);
  await expect(page.locator('#teacher-profile')).toContainText(email);
}

async function draft(page, title, { school, file = false } = {}) {
  const form = page.locator('#resources form');
  if (school) await form.getByLabel('Phạm vi duyệt').selectOption({ label: school });
  await form.getByLabel('Tiêu đề').fill(title);
  await form.getByLabel('Mô tả').fill('Tài liệu hư cấu ' + tag);
  await form.getByLabel('Danh mục').fill('Tin học');
  await form.getByLabel('Cấp học').fill('THPT');
  await form.getByLabel('Loại tài liệu').selectOption(file ? 'authored_document' : 'external_link');
  if (!file) await form.getByLabel('URL nguồn HTTPS').fill('https://example.invalid/course');
  await form.getByLabel('Căn cứ quyền phân phối').selectOption(file ? 'own_work' : 'official_link');
  await form.getByLabel('Quyền truy cập').selectOption('public');
  const response = page.waitForResponse(r => r.url().endsWith('/api/teacher/resources') && r.request().method() === 'POST');
  await form.getByRole('button', { name: 'Tạo bản nháp' }).click();
  const created = await response;
  expect(created.status()).toBe(201);
  await expect(page.locator('#resource-details')).toContainText(title);
  if (file) await upload(page, 'Initial');
  return (await created.json()).resource_id;
}

async function upload(page, label) {
  await page.getByLabel('Tệp PDF').setInputFiles({ name: 'fixture.pdf', mimeType: 'application/pdf', buffer: pdf(label) });
  await page.getByRole('button', { name: 'Tải PDF lên' }).click();
  await expect(page.locator('#feedback')).toContainText('Đã tải tệp PDF.');
}

async function submit(page) {
  await page.getByRole('button', { name: 'Gửi duyệt' }).click();
  await expect(page.locator('#feedback')).toContainText('Đã gửi duyệt.');
}

async function schoolDecision(page, title, decision, note) {
  await page.goto('/school/');
  const row = page.getByRole('row').filter({ hasText: title });
  await row.getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(page.locator('#detail-title')).toHaveText(title);
  if (note) await page.locator('#review-note').fill(note);
  await page.getByRole('button', { name: decision === 'approve' ? 'Chấp thuận' : 'Từ chối', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.locator('#review-status')).toContainText(decision === 'approve' ? 'Đã chấp thuận' : 'Đã từ chối');
  await expect(row).toHaveCount(0);
}

async function search(page, title) {
  await page.goto('/student/');
  await page.locator('#query').fill(title);
  await page.locator('#query').press('Enter');
}

async function studentVersion(page, title, version) {
  await search(page, title);
  await page.getByRole('button', { name: 'Xem chi tiết ' + title }).click();
  await expect(page.locator('#detail-title')).toHaveText(title);
  await expect(page.locator('#detail-content dd').nth(3)).toHaveText(String(version));
}

test('A–G: real four-role workflow, including permissions, versioning and withdrawal', async ({ browser, page: governmentPage, baseURL }) => {
  const pool = createDatabasePool(loadConfig().database);
  const repository = createUserRepository(pool);
  const govEmail = 'government-' + tag + '@example.test';
  const adminEmail = 'admin-' + tag + '@example.test';
  const teacherEmail = 'teacher-' + tag + '@example.test';
  const independentEmail = 'independent-' + tag + '@example.test';
  const name = 'Trường E2E ' + tag;
  const title = 'Tài liệu School ' + tag;
  const secondTitle = 'Tài liệu sửa lại ' + tag;
  const independentTitle = 'Tài liệu độc lập ' + tag;
  const passwordHash = await hashPassword(password);
  const contexts = [];
  const newPage = async () => {
    const context = await browser.newContext({ baseURL });
    context.setDefaultTimeout(10000);
    context.setDefaultNavigationTimeout(15000);
    contexts.push(context);
    return context.newPage();
  };

  try {
    await repository.create({ full_name: 'Government fixture', email: govEmail, password_hash: passwordHash }, 'government');
    const teacher = await newPage();
    const school = await newPage();
    const student = await newPage();

    await test.step('A: Government provisions School, Teacher submits PDF, School approves, Student downloads', async () => {
      await login(governmentPage, '/gorvernment/auth/login.html', govEmail);
      await governmentPage.getByRole('link', { name: 'Quản lý trường' }).click();
      await governmentPage.getByLabel('Mã trường').fill('E2E-' + tag);
      await governmentPage.getByLabel('Tên trường').fill(name);
      await governmentPage.getByLabel('Pattern mã giáo viên').fill('^GV[0-9]{5}$');
      await governmentPage.getByRole('button', { name: 'Tạo trường' }).click();
      await expect(governmentPage.locator('#feedback')).toContainText('Đã tạo trường.');
      await governmentPage.getByRole('link', { name: 'Quy tắc mã giáo viên' }).click();
      await governmentPage.getByRole('button', { name: 'Xem ' + name, exact: true }).click();
      await governmentPage.getByLabel('Pattern mã giáo viên').fill('^GV[0-9]{6}$');
      await governmentPage.getByRole('button', { name: 'Lưu pattern' }).click();
      await expect(governmentPage.locator('#feedback')).toContainText('Đã lưu pattern.');
      await governmentPage.getByRole('link', { name: 'Tài khoản School' }).click();
      await governmentPage.getByLabel('Tìm trường').fill(name);
      await governmentPage.getByRole('button', { name: 'Tìm trường', exact: true }).click();
      const schoolCard = governmentPage.locator('section.card').filter({ has: governmentPage.getByRole('heading', { name, exact: true }) }).last();
      await schoolCard.getByRole('button', { name: 'Xem tài khoản trường' }).click();
      await governmentPage.getByLabel('Họ tên').fill('School Admin ' + tag);
      await governmentPage.getByLabel('Email').fill(adminEmail);
      await governmentPage.getByLabel('Mật khẩu ban đầu').fill(password);
      await governmentPage.getByRole('button', { name: 'Cấp tài khoản School Admin' }).click();
      await expect(governmentPage.locator('#feedback')).toContainText('Đã cấp tài khoản');

      await register(teacher, teacherEmail);
      await teacher.getByLabel('Trường', { exact: true }).selectOption({ label: name });
      await teacher.getByLabel('Mã giáo viên').fill('GV000001');
      await teacher.getByRole('button', { name: 'Khai báo liên kết' }).click();
      await expect(teacher.locator('#feedback')).toContainText('Đã khai báo liên kết trường.');
      await draft(teacher, title, { school: name, file: true });
      await submit(teacher);
      await login(school, '/school/login.html', adminEmail);
      await expect(school.locator('#school-profile')).toContainText(name);
      await schoolDecision(school, title, 'approve');
      for (const protectedPage of [governmentPage, teacher, school]) {
        for (const width of [1440, 820, 390]) {
          await protectedPage.setViewportSize({ width, height: 900 });
          expect(await protectedPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        }
        await protectedPage.setViewportSize({ width: 1440, height: 900 });
      }
      await studentVersion(student, title, 1);
      const download = student.waitForEvent('download');
      await student.getByRole('link', { name: 'Tải PDF', exact: true }).click();
      const file = await download;
      expect(file.suggestedFilename()).toMatch(/^resource-\d+\.pdf$/);
      expect(await file.failure()).toBeNull();
      expect(await readFile(await file.path())).toEqual(pdf('Initial'));
      const preview = await student.request.get(await student.getByRole('link', { name: 'Xem trước PDF' }).getAttribute('href'));
      expect(preview.status()).toBe(200);
      expect(preview.headers()['content-disposition']).toContain('inline');
    });

    const published = await (await student.request.get('/api/public/resources?search=' + encodeURIComponent(title))).json();
    const id = published.data[0].id;

    await test.step('D/E: Published V1 survives pending/rejected V2, suspension blocks decisions', async () => {
      await teacher.reload();
      const card = teacher.locator('.resource-list article').filter({ hasText: title });
      await card.getByRole('button', { name: 'Xem tài liệu' }).click();
      await teacher.getByRole('button', { name: 'Tạo phiên bản mới' }).click();
      await expect(teacher.locator('#resource-details')).toContainText('Phiên bản 2');
      await submit(teacher);
      await studentVersion(student, title, 1);

      await governmentPage.goto('/gorvernment/#schools');
      await governmentPage.getByRole('button', { name: 'Xem ' + name, exact: true }).click();
      governmentPage.once('dialog', dialog => dialog.accept());
      await governmentPage.getByRole('button', { name: 'Đình chỉ trường', exact: true }).click();
      await expect(governmentPage.locator('#feedback')).toContainText('Đã cập nhật trạng thái trường.');
      await school.reload();
      await expect(school.locator('#review-status')).toContainText('Trường đang bị đình chỉ');
      await expect(school.getByRole('row').filter({ hasText: title })).toHaveCount(0);
      const suspendedReview = (await (await teacher.request.get('/api/teacher/resources/' + id + '/reviews')).json())[0];
      expect((await school.request.post('/api/school/reviews/' + suspendedReview.review_id + '/approve',
        { headers: { Origin: baseURL }, data: {} })).status()).toBe(403);
      await studentVersion(student, title, 1);
      governmentPage.once('dialog', dialog => dialog.accept());
      await governmentPage.getByRole('button', { name: 'Kích hoạt trường', exact: true }).click();
      await expect(governmentPage.locator('#feedback')).toContainText('Đã cập nhật trạng thái trường.');
      await schoolDecision(school, title, 'reject', 'Sửa nội dung V2');
      await studentVersion(student, title, 1);
    });

    await test.step('C: Rejected first Version remains private until a corrected Version is approved', async () => {
      await draft(teacher, secondTitle, { school: name });
      await submit(teacher);
      await schoolDecision(school, secondTitle, 'reject', 'Cần làm rõ nguồn');
      await teacher.reload();
      await teacher.locator('.resource-list article').filter({ hasText: secondTitle }).getByRole('button', { name: 'Xem tài liệu' }).click();
      await expect(teacher.locator('#resource-details')).toContainText('Cần làm rõ nguồn');
      await teacher.getByRole('button', { name: 'Tạo phiên bản mới' }).click();
      await expect(teacher.locator('#resource-details')).toContainText('Phiên bản 2');
      await teacher.locator('#resource-details input[name=title]').fill(secondTitle + ' V2');
      await teacher.getByRole('button', { name: 'Lưu bản nháp' }).click();
      await expect(teacher.locator('#feedback')).toContainText('Đã lưu bản nháp.');
      await submit(teacher);
      await schoolDecision(school, secondTitle + ' V2', 'approve');
      await studentVersion(student, secondTitle + ' V2', 2);
    });

    await test.step('B: Independent Teacher publishes through Government and Student resolves HTTPS', async () => {
      const independent = await newPage();
      await register(independent, independentEmail);
      await expect(independent.locator('#associations')).toContainText('Chưa khai báo liên kết trường.');
      await draft(independent, independentTitle);
      await submit(independent);
      await governmentPage.goto('/gorvernment/#reviews');
      await governmentPage.getByRole('button', { name: 'Xem kiểm duyệt ' + independentTitle }).click();
      await governmentPage.getByRole('button', { name: 'Chấp thuận', exact: true }).click();
      await expect(governmentPage.locator('#feedback')).toContainText('đã xuất bản');
      await studentVersion(student, independentTitle, 1);
      await student.getByRole('button', { name: 'Lấy liên kết ngoài' }).click();
      const link = student.getByRole('link', { name: 'Mở trang web bên thứ ba' });
      await expect(link).toHaveAttribute('href', 'https://example.invalid/course');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    await test.step('F: Role, guest, school scope, Origin and expired session checks', async () => {
      expect((await teacher.request.get('/api/government/schools')).status()).toBe(403);
      expect((await student.request.get('/api/teacher/resources/' + id)).status()).toBe(401);
      expect((await teacher.request.post('/api/teacher/resources', { data: {} })).status()).toBe(403);
      const unpublished = await draft(teacher, 'Tài liệu riêng ' + tag, { file: true });
      expect((await student.request.get('/api/public/resources/' + unpublished + '/download')).status()).toBe(404);

      const ownReviews = await (await teacher.request.get('/api/teacher/resources/' + id + '/reviews')).json();
      const [otherSchool] = await pool.execute('INSERT INTO schools (school_code, school_name, teacher_id_pattern) VALUES (?, ?, ?)',
        ['OTHER-' + tag, 'Other School', '^AA$']);
      const otherEmail = 'other-' + tag + '@example.test';
      await pool.execute("INSERT INTO users (full_name,email,password_hash,role,school_id) VALUES (?,?,?,'school_admin',?)",
        ['Other Admin', otherEmail, passwordHash, otherSchool.insertId]);
      const other = await newPage();
      await login(other, '/school/login.html', otherEmail);
      expect((await other.request.get('/api/school/reviews/' + ownReviews[0].review_id)).status()).toBe(404);
      expect((await other.request.post('/api/school/reviews/' + ownReviews[0].review_id + '/approve',
        { headers: { Origin: baseURL }, data: {} })).status()).toBe(404);
      await other.goto('/gorvernment/#schools');
      await expect(other).toHaveURL(/\/school\//);
      await expect(other.getByRole('button', { name: 'Tạo trường' })).toHaveCount(0);

      await pool.execute("UPDATE auth_sessions SET expires_at = 0 WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId')) = ?",
        [(await repository.findByEmail(otherEmail)).id]);
      expect((await other.request.post('/api/school/reviews/' + ownReviews[0].review_id + '/approve',
        { headers: { Origin: baseURL }, data: {} })).status()).toBe(401);
      await other.goto('/school/');
      await expect(other).toHaveURL(/expired=1/);
    });

    await test.step('Phase 3.1 G: two School Admins decide on the same Pending Review', async () => {
      const raceTitle = 'Kiểm duyệt đồng thời ' + tag;
      const raceId = await draft(teacher, raceTitle, { school: name });
      await submit(teacher);
      const secondEmail = 'second-reviewer-' + tag + '@example.test';
      const existingAdmin = await repository.findByEmail(adminEmail);
      await pool.execute("INSERT INTO users (full_name,email,password_hash,role,school_id) VALUES (?,?,?,'school_admin',?)",
        ['Second reviewer', secondEmail, passwordHash, existingAdmin.school_id]);
      const secondReviewer = await newPage();
      await login(secondReviewer, '/school/login.html', secondEmail);
      await school.goto('/school/');
      for (const reviewer of [school, secondReviewer]) {
        await reviewer.getByRole('row').filter({ hasText: raceTitle }).getByRole('button', { name: 'Xem chi tiết' }).click();
        await expect(reviewer.locator('#detail-title')).toHaveText(raceTitle);
      }
      await secondReviewer.locator('#review-note').fill('Lý do từ chối cạnh tranh');
      await school.getByRole('button', { name: 'Chấp thuận', exact: true }).click();
      await secondReviewer.getByRole('button', { name: 'Từ chối', exact: true }).click();
      const responses = Promise.all([school.waitForResponse(r => r.url().endsWith('/approve')),
        secondReviewer.waitForResponse(r => r.url().endsWith('/reject'))]);
      await Promise.all([school.locator('#confirm-action').click(), secondReviewer.locator('#confirm-action').click()]);
      const pair = await responses;
      expect(pair.map(response => response.status()).sort()).toEqual([200, 409]);
      const winner = await pair.find(response => response.status() === 200).json();
      const loser = pair[0].status() === 409 ? school : secondReviewer;
      await expect(loser.locator('#review-status')).toContainText('Tài liệu này đã được xử lý.');
      const [rows] = await pool.execute(`SELECT rv.decision, rv.reviewer_id, r.published_version_id
        FROM resources r JOIN resource_versions v ON v.resource_id = r.id
        JOIN resource_reviews rv ON rv.version_id = v.id WHERE r.id = CAST(? AS UNSIGNED)`, [raceId]);
      expect(rows).toEqual([{ decision: winner.decision, reviewer_id: winner.reviewer_id,
        published_version_id: winner.decision === 'approved' ? winner.version_id : null }]);
    });

    await test.step('G: Withdrawal disables public access and later approval cannot republish', async () => {
      await governmentPage.goto('/gorvernment/#reviews');
      await governmentPage.getByLabel('Resource ID').fill(id);
      await governmentPage.getByLabel('Lý do rút xuất bản').fill('Rút quyền phân phối thử nghiệm');
      governmentPage.once('dialog', dialog => dialog.accept());
      await governmentPage.getByRole('button', { name: 'Rút xuất bản', exact: true }).click();
      await expect(governmentPage.locator('#feedback')).toContainText('đang ẩn');
      for (const suffix of ['', '/download', '/preview']) {
        expect((await student.request.get('/api/public/resources/' + id + suffix)).status()).toBe(404);
      }
      await search(student, title);
      await expect(student.locator('#resources')).toContainText('Không tìm thấy tài liệu phù hợp.');
      expect((await teacher.request.post('/api/government/resources/' + id + '/reinstate',
        { headers: { Origin: baseURL }, data: { version_id: '1' } })).status()).toBe(403);

      const reservation = createServer().listen(0, '127.0.0.1');
      await once(reservation, 'listening');
      const port = reservation.address().port;
      await new Promise(resolve => reservation.close(resolve));
      const restartOrigin = 'http://127.0.0.1:' + port;
      const restarted = spawn(process.execPath, ['src/server.js'], {
        env: { ...process.env, NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(port), AUTH_ORIGINS: restartOrigin },
        stdio: ['ignore', 'ignore', 'ignore']
      });
      const closed = once(restarted, 'close');
      try {
        await expect.poll(async () => {
          try { return (await fetch(restartOrigin + '/api/health')).status; } catch { return 0; }
        }).toBe(200);
        for (const suffix of ['', '/download', '/preview']) {
          expect((await fetch(restartOrigin + '/api/public/resources/' + id + suffix)).status).toBe(404);
        }
      } finally {
        restarted.kill();
        await closed;
      }

      await teacher.reload();
      await teacher.locator('.resource-list article').filter({ hasText: title }).getByRole('button', { name: 'Xem tài liệu' }).click();
      await teacher.getByRole('button', { name: 'Tạo phiên bản mới' }).first().click();
      await expect(teacher.locator('#resource-details')).toContainText('Phiên bản 3');
      await submit(teacher);
      await schoolDecision(school, title, 'approve');
      expect((await student.request.get('/api/public/resources/' + id)).status()).toBe(404);

      await teacher.getByRole('button', { name: 'Đăng xuất' }).click();
      await expect(teacher).toHaveURL(/teacher\/auth\/login/);
      expect((await teacher.request.get('/api/teacher/profile')).status()).toBe(401);
    });
  } finally {
    for (const context of contexts) await context.close();
    await pool.end();
  }
});

test('Student and auth layouts fit desktop, tablet and mobile widths', async ({ page }) => {
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/student/');
    await expect(page.locator('#result-count')).toContainText(/\d+ tài liệu/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.matches(':focus-visible'))).toBe(true);
    if (width === 390) {
      await page.getByRole('button', { name: 'Bộ lọc' }).click();
      await expect(page.getByRole('dialog', { name: 'Bộ lọc tài liệu' })).toBeVisible();
      await page.keyboard.press('Escape');
    }
    for (const path of ['/teacher/auth/login.html', '/school/login.html', '/gorvernment/auth/login.html']) {
      await page.goto(path);
      await expect(page.locator('button[type=submit]')).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});
