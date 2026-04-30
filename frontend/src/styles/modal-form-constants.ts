import type { CSSProperties } from 'react';

/**
 * モーダル・フォーム共通スタイル定数
 * auth モーダル / journal フォーム / キャッシュ管理モーダルなど
 * 全体で共有するインラインスタイルをここで定義する。
 */

/** 全画面オーバーレイ（ぼかし付き半透明背景） */
export const MODAL_OVERLAY: CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 3000,
  backdropFilter: 'blur(4px)',
};

/**
 * モーダルコンテナ基底スタイル
 * maxWidth はコンポーネントごとに上書きする
 * 例: { ...MODAL_CONTAINER, maxWidth: '400px' }
 */
export const MODAL_CONTAINER: CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '8px',
  padding: '24px',
  width: '90%',
  maxHeight: '90vh',
  overflowY: 'auto',
};

/** モーダルヘッダー行（タイトル + 閉じるボタン） */
export const MODAL_HEADER: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px',
  paddingBottom: '12px',
  color: '#333',
};

/** モーダルタイトル（h3 等に適用） */
export const MODAL_TITLE: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

/** 右上の × 閉じるボタン */
export const MODAL_CLOSE_BUTTON: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '24px',
  cursor: 'pointer',
  color: '#6b7280',
};

/** フォーム要素の縦積みコンテナ */
export const MODAL_FORM: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

/** 各フォームフィールドのグループ（ラベル + 入力） */
export const FORM_GROUP: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

/** フォームラベル */
export const FORM_LABEL: CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: '#374151',
};

/** テキスト入力 / パスワード入力 */
export const FORM_INPUT: CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '14px',
};

/** セレクトボックス（= FORM_INPUT + 白背景） */
export const FORM_SELECT: CSSProperties = {
  ...FORM_INPUT,
  backgroundColor: 'white',
};

/** テキストエリア */
export const FORM_TEXTAREA: CSSProperties = {
  ...FORM_INPUT,
  minHeight: '60px',
  resize: 'vertical',
};

/** エラーメッセージ */
export const FORM_ERROR: CSSProperties = {
  color: '#ef4444',
  fontSize: '14px',
  marginTop: '4px',
};

/** 補足テキスト（入力欄の下に表示する説明） */
export const FORM_HELP_TEXT: CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  lineHeight: 1.6,
  marginTop: '2px',
};

/** ボタン行（右寄せ） */
export const BUTTON_GROUP: CSSProperties = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end',
  marginTop: '20px',
};

/** ボタン基底スタイル */
export const BUTTON_BASE: CSSProperties = {
  padding: '10px 20px',
  borderRadius: '8px',
  border: 'none',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  minWidth: '120px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  transition: 'background-color 0.2s ease',
};

/** キャンセルボタン色 */
export const BUTTON_CANCEL: CSSProperties = {
  backgroundColor: '#f3f4f6',
  color: '#374151',
};

/** 送信（プライマリ）ボタン色 */
export const BUTTON_SUBMIT: CSSProperties = {
  backgroundColor: '#3b82f6',
  color: 'white',
};

/** 無効化状態ボタン（ローディング中など） */
export const BUTTON_DISABLED: CSSProperties = {
  backgroundColor: '#9ca3af',
  cursor: 'not-allowed',
};
