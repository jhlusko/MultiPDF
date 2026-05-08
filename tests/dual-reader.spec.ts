import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const minimalPdf = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 2/Kids[3 0 R 4 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 300]>>endobj
4 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 300]>>endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000120 00000 n 
0000000187 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
254
%%EOF`;

test('opens a local PDF and renders synchronized viewer windows', async ({ page, context }) => {
  const pdfPath = join(tmpdir(), `multipdf-${Date.now()}.pdf`);
  await writeFile(pdfPath, minimalPdf);

  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');
  await page.locator('#fileInput').setInputFiles(pdfPath);

  await expect(page.locator('#openDual')).toBeEnabled();
  await expect(page.locator('#spreadLabel')).toHaveText('Spread 1 of 2');
  await expect(page.locator('#status')).toContainText('"pageCount": 2');

  const viewerPages: typeof page[] = [];
  context.on('page', (popup) => viewerPages.push(popup));
  await page.locator('#openDual').click();

  await expect
    .poll(() => viewerPages.map((popup) => new URL(popup.url()).searchParams.get('role')).sort())
    .toEqual(['left', 'right']);

  const left = viewerPages.find((popup) => new URL(popup.url()).searchParams.get('role') === 'left')!;
  const right = viewerPages.find((popup) => new URL(popup.url()).searchParams.get('role') === 'right')!;

  await expect(left.locator('#roleBadge')).toHaveText('LEFT');
  await expect(right.locator('#roleBadge')).toHaveText('RIGHT');
  await expect(left.locator('#pageLabel')).toHaveText('Blank');
  await expect(right.locator('#pageLabel')).toHaveText('Page 1');
  await expect(right.locator('#canvas')).toBeVisible();
  await expect(left.locator('#viewerPrev')).toHaveCount(0);
  await expect(left.locator('#viewerNext')).toHaveCount(0);

  await page.locator('#next').click();
  await expect(left.locator('#pageLabel')).toHaveText('Page 2');
  await expect(right.locator('#pageLabel')).toHaveText('Blank');

  await right.keyboard.press('ArrowLeft');
  await expect(left.locator('#pageLabel')).toHaveText('Blank');
  await expect(right.locator('#pageLabel')).toHaveText('Page 1');

  await right.keyboard.press('ArrowRight');
  await expect(left.locator('#pageLabel')).toHaveText('Page 2');
  await expect(right.locator('#pageLabel')).toHaveText('Blank');

  expect(consoleErrors).toEqual([]);
});
