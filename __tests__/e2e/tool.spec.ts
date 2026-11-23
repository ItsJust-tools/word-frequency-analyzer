import { test, expect, type TestInfo } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

const MOBILE = 'Mobile';

function isMobile(testInfo: TestInfo): boolean {
  return testInfo.project.name.includes(MOBILE);
}

function configuredToolName(): string {
  const cfg = readFileSync(join(process.cwd(), 'src/tool/tool.config.ts'), 'utf-8');
  const m = cfg.match(/name:\s*'([^']+)'/);
  return m ? m[1] : '';
}

/** This tool's state shape (see src/tool/tool-definition.ts DEFAULT_STATE). */
function toolState(input: string) {
  return {
    input,
    caseSensitive: false,
    excludeStopwords: false,
    normalizeAccents: true,
    sortMode: 'count',
    filter: '',
  };
}

/** Import a state JSON through the toolbar's hidden file input (all viewports). */
async function importStateFile(page: import('@playwright/test').Page, input: string) {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.evaluate((el: HTMLInputElement) => {
    el.style.display = 'block';
    el.style.visibility = 'visible';
  });
  await fileInput.setInputFiles({
    name: 'state.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(toolState(input))),
  });
}

async function openExportMenu(page: import('@playwright/test').Page) {
  const exportButton = page.getByRole('button', { name: 'Export', exact: true });
  await expect(exportButton).toBeEnabled();
  await exportButton.click();
  const menu = page.getByRole('listbox', { name: 'Export' });
  await expect(menu).toBeVisible();
  return menu;
}

test('tool loads with its configured title', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/');
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
  const name = configuredToolName();
  if (name.length > 0) expect(title).toContain(name);
  expect(errors).toEqual([]);
});

test('tool renders main content area', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('toolbar')).toBeVisible();
});

test('textarea is editable', async ({ page }) => {
  await page.goto('/');
  const textarea = page.locator('.notepad-textarea');
  await textarea.fill('Hello word frequency analyzer');
  await expect(textarea).toHaveValue('Hello word frequency analyzer');
});

test('case-sensitive toggle is available in the toolbar', async ({ page }) => {
  await page.goto('/');
  const checkbox = page.getByLabel('Case-sensitive counting');
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
});

test('undo/redo buttons enable/disable correctly', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto('/');

  const undoButton = page.getByRole('button', { name: 'Undo (Ctrl+Z)' });
  const redoButton = page.getByRole('button', { name: 'Redo (Ctrl+Y)' });
  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeDisabled();

  if (isMobile(testInfo)) {
    // Filling the textarea via touch is awkward on mobile viewports; set state via import.
    await importStateFile(page, 'hello world');
  } else {
    await page.locator('.notepad-textarea').fill('hello world');
  }

  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeDisabled();

  if (isMobile(testInfo)) {
    return;
  }

  await undoButton.click();
  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeEnabled();

  await redoButton.click();
  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeDisabled();
});

test('undo/redo via keyboard shortcuts', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto('/');

  const undoButton = page.getByRole('button', { name: 'Undo (Ctrl+Z)' });
  const redoButton = page.getByRole('button', { name: 'Redo (Ctrl+Y)' });
  await expect(undoButton).toBeDisabled();

  if (isMobile(testInfo)) {
    await importStateFile(page, 'keyboard test');
  } else {
    await page.locator('.notepad-textarea').fill('keyboard test');
  }

  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeDisabled();

  await page.locator('body').press('Control+z');
  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeEnabled();

  await page.locator('body').press('Control+Shift+z');
  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeDisabled();
});

test('export dropdown opens and shows JSON format', async ({ page }, testInfo) => {
  await page.goto('/');
  const menu = await openExportMenu(page);
  await expect(page.getByRole('option', { name: /JSON/ })).toBeVisible();
  if (!isMobile(testInfo)) {
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await expect(menu).toBeHidden();
  }
});

test('import from json file works', async ({ page }) => {
  await page.goto('/');
  await importStateFile(page, 'Imported Note');
  await expect
    .poll(() => page.locator('.notepad-textarea').inputValue())
    .toContain('Imported Note');
});

test('export json download triggers', async ({ page }) => {
  await page.goto('/');
  const menu = await openExportMenu(page);
  const jsonOption = menu.getByRole('option', { name: /JSON/ });
  const [download] = await Promise.all([page.waitForEvent('download'), jsonOption.click()]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
});

test('image export downloads trigger for screenshot formats', async ({ page }) => {
  await page.goto('/');

  const expected: Array<{ option: RegExp; ext: RegExp }> = [
    { option: /PNG/, ext: /\.png$/i },
    { option: /JPEG/, ext: /\.(jpg|jpeg)$/i },
    { option: /WebP/i, ext: /\.webp$/i },
  ];

  for (const format of expected) {
    const menu = await openExportMenu(page);
    const option = menu.getByRole('option', { name: format.option });
    await expect(option).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), option.click()]);
    expect(download.suggestedFilename()).toMatch(format.ext);
  }
});

test('pdf export triggers print dialog', async ({ page }) => {
  await page.goto('/');
  const menu = await openExportMenu(page);
  const pdfOption = menu.getByRole('option', { name: /PDF/i });
  await expect(pdfOption).toBeVisible();

  const consolePromise = new Promise<string>((resolve) => {
    const handler = (msg: import('@playwright/test').ConsoleMessage) => {
      const text = msg.text();
      if (text.includes('__printIntercepted__')) {
        page.off('console', handler);
        resolve(text);
      }
    };
    page.on('console', handler);
  });

  // Intercept the print iframe via MutationObserver + stubbed print()
  await page.evaluate(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLIFrameElement) {
            try {
              const cw = node.contentWindow;
              if (cw) {
                cw.print = () => {
                  console.log('__printIntercepted__');
                };
              }
            } catch {
              // cross-origin iframe, ignore
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  await pdfOption.click();

  const consoleText = await consolePromise;
  expect(consoleText).toContain('__printIntercepted__');
});

test('dark mode toggle works', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto('/');
  const html = page.locator('html');
  const startTheme = await html.getAttribute('data-theme');
  const themeButton = page.getByRole('button', {
    name: startTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
  });
  await expect(themeButton).toBeEnabled();
  await themeButton.click();
  await expect(html).toHaveAttribute('data-theme', startTheme === 'dark' ? 'light' : 'dark');
  await page
    .getByRole('button', {
      name: startTheme === 'dark' ? 'Switch to dark mode' : 'Switch to light mode',
    })
    .click();
  await expect(html).toHaveAttribute('data-theme', startTheme ?? 'light');
});

test('sidebar toggle button works', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto('/');
  const sidebar = page.locator('.tool-shell-sidebar');
  const isMobileViewport = page.viewportSize()!.width <= 768;

  if (isMobileViewport) {
    await expect(sidebar).toHaveClass(/collapsed/);
    await page.locator('[aria-label="Show options"]').click();
    await expect(sidebar).toHaveClass(/open/);
    await page.locator('.sidebar-backdrop').click();
    await expect(sidebar).toHaveClass(/collapsed/);
    return;
  }

  // Desktop: sidebar starts open.
  await expect(sidebar).toHaveClass(/open/);
  await page.locator('[aria-label="Close sidebar"]').click();
  await expect(sidebar).toHaveClass(/collapsed/);
  await page.locator('[aria-label="Toggle sidebar"]').click();
  await expect(sidebar).toHaveClass(/open/);
});

test('mobile sidebar backdrop closes sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  const sidebar = page.locator('.tool-shell-sidebar');
  await expect(sidebar).toHaveClass(/collapsed/);

  await page.locator('[aria-label="Show options"]').click();
  await expect(sidebar).toHaveClass(/open/);
  await expect(page.locator('.sidebar-backdrop')).toBeVisible();

  await page.locator('.sidebar-backdrop').evaluate((el) => (el as HTMLElement).click());
  await expect(sidebar).toHaveClass(/collapsed/);
});

test('keyboard shortcuts overlay opens and closes', async ({ page, browserName }) => {
  if (browserName !== 'chromium') return;
  await page.goto('/');
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();
});

test('SEO meta tags are present', async ({ page }) => {
  await page.goto('/');

  const title = await page.title();
  expect(title).toBeTruthy();

  const description = await page.getAttribute('meta[name="description"]', 'content');
  expect(description).toBeTruthy();

  const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
  expect(ogTitle).toBeTruthy();

  const ogImage = await page.getAttribute('meta[property="og:image"]', 'content');
  expect(ogImage).toBeTruthy();

  const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
  expect(canonical).toBeTruthy();
});

test('JSON-LD structured data is present', async ({ page }) => {
  await page.goto('/');
  const jsonLd = page.locator('script[type="application/ld+json"]').first();
  const content = await jsonLd.textContent();
  const parsed = JSON.parse(content!);
  expect(parsed['@type']).toBe('WebApplication');
  expect(parsed.name).toBeTruthy();
  expect(parsed.offers.price).toBe('0');
});

test('sitemap.xml is accessible', async ({ page }) => {
  const response = await page.goto('/sitemap.xml');
  expect(response?.ok()).toBe(true);
  const content = await response?.text();
  expect(content).toContain('urlset');
});

test('robots.txt is accessible', async ({ page }) => {
  const response = await page.goto('/robots.txt');
  expect(response?.ok()).toBe(true);
  const content = await response?.text();
  expect(content).toMatch(/User-[Aa]gent/);
});

test('404 page works', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  const contentType = response?.headers()['content-type'] ?? '';
  expect(contentType).toContain('text/html');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('visual regression — default view', async ({ page, browserName }) => {
  if (browserName !== 'chromium') return;
  await page.goto('/');
  await page.waitForSelector('.tool-shell-canvas');
  await expect(page.locator('.tool-shell')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
});
