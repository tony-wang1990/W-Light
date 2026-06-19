import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Downloads, { DOWNLOAD_EXPORTS } from './Downloads';

const { downloadMock } = vi.hoisted(() => ({
  downloadMock: vi.fn<(url: string, filename: string) => Promise<void>>(async () => undefined),
}));

vi.mock('../../api/client', () => ({
  apiClient: {
    download: downloadMock,
  },
}));

describe('downloads center', () => {
  beforeEach(() => {
    downloadMock.mockClear();
  });

  it('keeps every visible Excel card mapped to its report endpoint', async () => {
    const user = userEvent.setup();
    render(<Downloads />);

    for (const item of DOWNLOAD_EXPORTS) {
      const card = screen.getByRole('heading', { name: item.title }).closest('article');
      expect(card).not.toBeNull();
      await user.click(within(card as HTMLElement).getByRole('button', { name: /下载 Excel/ }));

      const lastCall = downloadMock.mock.calls.at(-1);
      expect(lastCall).toBeDefined();
      const [url, filename] = lastCall as [string, string];
      expect(url).toContain(`/reports/export/${item.path}`);
      expect(filename).toContain(`w-light-${item.filenamePrefix}-`);
      if (item.usesDateRange) {
        expect(url).toContain('startDate=');
        expect(url).toContain('endDate=');
      } else {
        expect(url).not.toContain('?');
      }
    }

    expect(downloadMock).toHaveBeenCalledTimes(DOWNLOAD_EXPORTS.length);
  });

  it('maps the two monthly report buttons to PDF and DOCX endpoints', async () => {
    const user = userEvent.setup();
    render(<Downloads />);

    await user.click(screen.getByRole('button', { name: /下载 PDF 报告/ }));
    expect(downloadMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\/reports\/export\/monthly-report\.pdf\?year=\d{4}&month=\d{2}$/),
      expect.stringMatching(/^w-light-monthly-report-\d{4}-\d{2}\.pdf$/),
    );

    await user.click(screen.getByRole('button', { name: /下载 Word\/DOCX/ }));
    expect(downloadMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/^\/reports\/export\/monthly-report\.docx\?year=\d{4}&month=\d{2}$/),
      expect.stringMatching(/^w-light-monthly-report-\d{4}-\d{2}\.docx$/),
    );
  });
});
