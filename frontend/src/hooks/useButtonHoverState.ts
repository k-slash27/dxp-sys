import type { MouseEvent } from 'react';

/**
 * ボタンのホバー時に背景色を変更するイベントハンドラを返す。
 *
 * @param defaultColor  通常時の背景色
 * @param hoverColor    ホバー時の背景色
 * @param disabled      true のとき色変化を行わない（ローディング中など）
 *
 * @example
 * // キャンセルボタン
 * const cancelHover = useButtonHoverState('#f3f4f6', '#e5e7eb', isLoading);
 * <button {...cancelHover} style={{ ...BUTTON_BASE, ...BUTTON_CANCEL }}>キャンセル</button>
 *
 * // 送信ボタン
 * const submitHover = useButtonHoverState('#3b82f6', '#2563eb', isLoading);
 * <button {...submitHover} ...>送信</button>
 */
export function useButtonHoverState(
  defaultColor: string,
  hoverColor: string,
  disabled = false,
) {
  return {
    onMouseEnter: (e: MouseEvent<HTMLButtonElement>) => {
      if (!disabled) e.currentTarget.style.backgroundColor = hoverColor;
    },
    onMouseLeave: (e: MouseEvent<HTMLButtonElement>) => {
      if (!disabled) e.currentTarget.style.backgroundColor = defaultColor;
    },
  };
}
