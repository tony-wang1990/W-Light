import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Toolbox from './Toolbox';

describe('Toolbox', () => {
  it('keeps the main menu focused on practical lighting tools', () => {
    render(<Toolbox />);

    ['BPM 测速', 'DMX 多灯具链', '功率负荷', '电缆压降', 'Art-Net 地址', 'RGB/色温'].forEach(label => {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    });

    ['故障诊断', '行业术语', 'MA 宏命令', '灯位设计', '灯光理论'].forEach(label => {
      expect(screen.queryByRole('button', { name: new RegExp(label) })).not.toBeInTheDocument();
    });
  });

  it('updates the RGB and HEX values when a palette color is selected', () => {
    render(<Toolbox />);

    fireEvent.click(screen.getByRole('button', { name: /RGB\/色温/ }));
    fireEvent.click(screen.getByRole('button', { name: /熔岩红/ }));

    expect(screen.getAllByText('#FF3020').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/RGB\(255, 48, 32\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('2200K').length).toBeGreaterThan(0);
  });
});
