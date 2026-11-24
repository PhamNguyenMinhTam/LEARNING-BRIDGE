const { test, expect } = require('@playwright/test');

const catalog = { data: [], pagination: { total: 0, page: 1, limit: 6, total_pages: 0 } };

test.describe('Browser regressions with injected API failures', () => {
  test('catalog reports unreadable responses and recovers after outage', async ({ page }) => {
    await page.route('**/api/public/filters', route => route.fulfill({
      json: { categories: [], education_levels: [], resource_types: [] }
    }));
    let failure = 'json';
    await page.route('**/api/public/resources?*', route => {
      if (failure === 'json') return route.fulfill({ status: 200, contentType: 'application/json', body: '{' });
      if (failure === 'html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Error</h1>' });
      if (failure === 'outage') return route.fulfill({ status: 503, contentType: 'text/html', body: 'Offline' });
      if (failure === 'network') return route.abort('failed');
      return route.fulfill({ json: catalog });
    });
    await page.goto('/student/');
    const status = page.locator('#result-count');
    await expect(status).toHaveText('Máy chủ trả về dữ liệu không hợp lệ.');
    failure = 'html';
    await page.locator('#query').press('Enter');
    await expect(status).toHaveText('Máy chủ trả về dữ liệu không hợp lệ.');
    failure = 'outage';
    await page.locator('#query').press('Enter');
    await expect(status).toHaveText('Máy chủ tạm thời không khả dụng.');
    failure = 'network';
    await page.locator('#query').press('Enter');
    await expect(status).toHaveText('Không thể kết nối đến máy chủ.');
    failure = null;
    await page.locator('#query').press('Enter');
    await expect(page.locator('#resources')).toContainText('Không tìm thấy tài liệu phù hợp.');
  });

  test('catalog times out when the backend stops responding', async ({ page }) => {
    await page.clock.install();
    await page.route('**/api/public/filters', route => route.fulfill({
      json: { categories: [], education_levels: [], resource_types: [] }
    }));
    await page.route('**/api/public/resources?*', () => {});
    const started = page.waitForRequest('**/api/public/resources?*');
    await page.goto('/student/');
    await started;
    await page.clock.fastForward(61000);
    await expect(page.locator('#result-count')).toHaveText('Máy chủ phản hồi quá chậm. Vui lòng thử lại.');
  });

  test('a stale School review response cannot replace the selected review', async ({ page }) => {
    const session = { id: '3', full_name: 'Admin fixture', role: 'school_admin' };
    const school = { school_name: 'Fixture School', status: 'active' };
    const first = { review_id: '11', title: 'First review', decision: 'pending' };
    const second = { review_id: '12', title: 'Second review', decision: 'pending' };
    const queue = { data: [first, second], pagination: { total: 2, page: 1, limit: 12 } };
    await page.route('**/api/auth/me', route => route.fulfill({ json: session }));
    await page.route('**/api/school/profile', route => route.fulfill({ json: { ...session, school } }));
    await page.route('**/api/school/reviews/pending?*', route => route.fulfill({ json: queue }));
    await page.route('**/api/school/reviews/history?*', route => route.fulfill({ json: catalog }));
    const old = new Promise(resolve => page.route('**/api/school/reviews/11', resolve));
    await page.route('**/api/school/reviews/12', route => route.fulfill({ json: second }));
    await page.goto('/school/');
    await page.getByRole('row').filter({ hasText: first.title }).getByRole('button', { name: 'Xem chi tiết' }).click();
    const delayed = await old;
    await page.locator('#close-review').click();
    await page.getByRole('row').filter({ hasText: second.title }).getByRole('button', { name: 'Xem chi tiết' }).click();
    await expect(page.locator('#detail-title')).toHaveText(second.title);
    await delayed.fulfill({ json: first });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('#detail-title')).toHaveText(second.title);
  });
});
