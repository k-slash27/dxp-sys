import { useState, useCallback } from 'react';
import React from 'react';

/**
 * サイドパネルの左端ドラッグでリサイズするフック。
 * パネルが画面右側に固定されているため、左方向ドラッグ（clientX 減少）で幅が増加する。
 */
export function useResizable(
  initialWidth = 350,
  minWidth = 240,
  maxWidth = 800,
) {
  const [width, setWidth] = useState(initialWidth);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = startX - ev.clientX; // 左へドラッグ → 幅増加
        setWidth(Math.min(maxWidth, Math.max(minWidth, startWidth + delta)));
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [width, minWidth, maxWidth],
  );

  /** 左端に配置するドラッグハンドル要素 */
  const resizeHandle = React.createElement('div', {
    onMouseDown: startResize,
    style: {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      bottom: 0,
      width: '6px',
      cursor: 'ew-resize',
      zIndex: 11,
      borderRadius: '4px 0 0 4px',
      background: 'transparent',
    },
  });

  return { width, resizeHandle };
}
