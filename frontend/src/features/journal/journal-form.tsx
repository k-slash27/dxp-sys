import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin, Camera, Trash2, Loader2, ArrowLeft, Save, Calendar } from 'lucide-react';
import {
  MODAL_OVERLAY, MODAL_CONTAINER,
  FORM_LABEL, FORM_INPUT, FORM_ERROR,
  BUTTON_BASE, BUTTON_CANCEL, BUTTON_SUBMIT,
} from '@/styles/modal-form-constants';

interface JournalEntry {
  id: string;
  workspace: string;
  record_date: string;
  text_content: string | null;
  photos: { filename: string; url: string }[];
  location: { lat: number; lng: number } | null;
  created_by: string;
}

interface JournalFormProps {
  workspace: string;
  userInfo: any;
  initialData: JournalEntry | null;
  /** trueのとき地図クリックで位置を取得するモード */
  pickingLocation: boolean;
  /** 地図クリック位置取得モードを開始する */
  onRequestLocationPick: () => void;
  /** 地図クリック位置取得モードをキャンセルする */
  onCancelLocationPick: () => void;
  /** 地図クリックで取得された座標 */
  pickedLocation: { lat: number; lng: number } | null;
  /** 座標の消費（フォームが受け取ったら呼ぶ） */
  onLocationConsumed: () => void;
  onSaved: () => void;
  onCancel: () => void;
  /** trueのときモーダルではなくインライン表示（サイドバー内埋め込み用） */
  inline?: boolean;
  /** 編集時のみ渡す。削除ボタンを表示する */
  onDelete?: () => void;
  deleting?: boolean;
  /** インラインモードで一覧に戻るボタンを表示する */
  onBack?: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function JournalForm({
  workspace,
  userInfo,
  initialData,
  pickingLocation,
  onRequestLocationPick,
  onCancelLocationPick,
  pickedLocation,
  onLocationConsumed,
  onSaved,
  onCancel,
  inline = false,
  onDelete,
  deleting = false,
  onBack,
}: JournalFormProps) {
  const isEdit = !!initialData;
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [recordDate, setRecordDate]   = useState(initialData?.record_date ?? today());
  const [textContent, setTextContent] = useState(initialData?.text_content ?? '');
  const [lat, setLat]                 = useState<string>(String(initialData?.location?.lat ?? ''));
  const [lng, setLng]                 = useState<string>(String(initialData?.location?.lng ?? ''));
  const [photos, setPhotos]           = useState<{ filename: string; url: string }[]>(initialData?.photos ?? []);
  const [newFiles, setNewFiles]       = useState<File[]>([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // 地図クリックで座標が渡ってきたら反映
  useEffect(() => {
    if (pickedLocation) {
      setLat(String(pickedLocation.lat.toFixed(6)));
      setLng(String(pickedLocation.lng.toFixed(6)));
      onLocationConsumed();
    }
  }, [pickedLocation, onLocationConsumed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body: Record<string, any> = {
        workspace,
        record_date: recordDate,
        text_content: textContent || null,
        created_by: userInfo?.username ?? 'unknown',
      };
      if (lat && lng) body.location = { lat: parseFloat(lat), lng: parseFloat(lng) };
      else if (isEdit) body.location = null;

      let entry: JournalEntry;
      if (isEdit) {
        const r = await fetch(`/api/journal/${initialData!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(await r.text());
        entry = await r.json();
      } else {
        const r = await fetch('/api/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(await r.text());
        entry = await r.json();
      }

      if (newFiles.length > 0) {
        const fd = new FormData();
        newFiles.forEach(f => fd.append('files', f));
        // Next.js API proxy を経由せず nginx → backend に直接アップロード
        const r = await fetch(`/api/register/journal/${entry.id}/photos`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error('写真のアップロードに失敗しました');
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePhoto = async (filename: string) => {
    if (!isEdit || !initialData) return;
    if (!confirm(`"${filename}" を削除しますか？`)) return;
    try {
      await fetch(`/api/journal/${initialData.id}/photos/${filename}`, { method: 'DELETE' });
      setPhotos(prev => prev.filter(p => p.filename !== filename));
    } catch {
      alert('写真の削除に失敗しました');
    }
  };

  const clearLocation = () => { setLat(''); setLng(''); };

  /* ---- スタイル定数（共有定数を拡張） ---- */
  const overlay = MODAL_OVERLAY;
  const modal: React.CSSProperties = {
    ...MODAL_CONTAINER,
    width: '480px', maxWidth: '95vw', padding: 0,
    color: '#374151', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontFamily: 'sans-serif', fontSize: '14px',
  };
  const field: React.CSSProperties = { marginBottom: '16px' };
  const labelStyle: React.CSSProperties = { ...FORM_LABEL, display: 'block', marginBottom: '6px' };
  const input: React.CSSProperties = {
    ...FORM_INPUT,
    width: '100%', boxSizing: 'border-box',
    backgroundColor: 'white', color: '#374151',
  };
  const textarea: React.CSSProperties = { ...input, minHeight: '100px', resize: 'vertical' };
  const btnPrimary: React.CSSProperties = { ...BUTTON_BASE, ...BUTTON_SUBMIT };
  const btnSecondary: React.CSSProperties = { ...BUTTON_BASE, ...BUTTON_CANCEL };
  const btnGhost: React.CSSProperties = { ...BUTTON_BASE, ...BUTTON_CANCEL, fontWeight: 400, minWidth: 'unset' };

  /* ---- フォーム本体 JSX（inline / modal 共通） ---- */
  const formBody = (
    <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
      {/* 記録日 */}
      <div style={field}>
        <label htmlFor="record-date" style={labelStyle}>記録日 *</label>
        <div style={{ position: 'relative' }}>
          {/* 表示層: フォーマット済み日付 + アイコン（pointer-events なし） */}
          <div style={{ ...input, display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none', pointerEvents: 'none' }}>
            <span>{new Date(recordDate + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
            <Calendar size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
          </div>
          {/* 操作層: 透明な date input で全体を覆う */}
          <input
            ref={dateInputRef}
            id="record-date"
            name="record_date"
            type="date"
            value={recordDate}
            required
            onChange={e => setRecordDate(e.target.value)}
            onClick={() => dateInputRef.current?.showPicker()}
            onKeyDown={e => e.preventDefault()}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', background: 'none' }}
          />
        </div>
      </div>

      {/* 作業内容 */}
      <div style={field}>
        <label style={labelStyle}>作業内容</label>
        <textarea value={textContent ?? ''}
                  onChange={e => setTextContent(e.target.value)}
                  placeholder="作業内容を入力してください"
                  style={textarea} />
      </div>

      {/* 場所 */}
      <div style={field}>
        <label style={labelStyle}>場所</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <button type="button" onClick={onRequestLocationPick}
                  style={{ ...btnGhost, fontSize: '13px', padding: '7px 14px' }}>
            <MapPin size={14} /> 地図から選択
          </button>
          {(lat || lng) && (
            <button type="button" onClick={clearLocation}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <X size={14} />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, fontSize: '11px' }}>緯度</label>
            <input type="number" step="any" value={lat}
                   onChange={e => setLat(e.target.value)}
                   placeholder="35.123456" style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ ...labelStyle, fontSize: '11px' }}>経度</label>
            <input type="number" step="any" value={lng}
                   onChange={e => setLng(e.target.value)}
                   placeholder="138.123456" style={input} />
          </div>
        </div>
      </div>

      {/* 写真 */}
      <div style={field}>
        <label style={labelStyle}>写真</label>
        {photos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            {photos.map(p => (
              <div key={p.filename} style={{ position: 'relative' }}>
                <img
                  src={`/api/register${p.url}`}
                  alt={p.filename}
                  style={{ width: '80px', height: '80px', objectFit: 'cover',
                           borderRadius: '6px', border: '1px solid #d1d5db' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {isEdit && (
                  <button type="button" onClick={() => handleDeletePhoto(p.filename)}
                          style={{ position: 'absolute', top: '-6px', right: '-6px',
                                   backgroundColor: '#ef4444', border: 'none', borderRadius: '50%',
                                   width: '20px', height: '20px', cursor: 'pointer',
                                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                                   color: '#fff', padding: 0 }}>
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {newFiles.length > 0 && (
          <div style={{ marginBottom: '8px', fontSize: '12px', color: '#9ca3af' }}>
            追加予定: {newFiles.map(f => f.name).join(', ')}
          </div>
        )}
        <label htmlFor="journal-photo-input"
               style={{ ...btnGhost, fontSize: '13px', padding: '7px 14px', cursor: 'pointer' }}>
          <Camera size={14} /> 写真を追加
        </label>
      </div>

      {/* エラー */}
      {error && (
        <div style={{ ...FORM_ERROR, padding: '10px', backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* ボタン */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', paddingTop: '8px' }}>
        {/* 左端: 一覧に戻る（インライン時） */}
        <div>
          {inline && onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '13px', padding: 0 }}
            >
              <ArrowLeft size={15} /> 一覧に戻る
            </button>
          )}
        </div>
        {/* 右端: キャンセル・保存 */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!inline && (
            <button type="button" style={btnSecondary} onClick={onCancel} disabled={saving}>
              キャンセル
            </button>
          )}
          <button type="submit" style={btnPrimary} disabled={saving}>
            {saving ? <><Loader2 size={14} /> 保存中…</> : <><Save size={14} /> 保存</>}
          </button>
        </div>
      </div>
    </form>
  );

  /* ---- ファイル input + 場所選択バナー（共通） ---- */
  const commonParts = (
    <>
      <input
        id="journal-photo-input"
        type="file" accept="image/*" multiple
        style={{ display: 'none' }}
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length > 0) setNewFiles(prev => [...prev, ...files]);
        }}
      />
      {pickingLocation && (
        <div style={{
          position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 3500, backgroundColor: '#1e3a5f', border: '2px solid #3b82f6',
          borderRadius: '12px', padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: '14px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)', color: '#e5e7eb',
          fontFamily: 'sans-serif', fontSize: '14px', whiteSpace: 'nowrap',
        }}>
          <MapPin size={18} color="#60a5fa" />
          <span>地図をクリックして場所を選択してください</span>
          <button onClick={onCancelLocationPick}
                  style={{ padding: '6px 14px', backgroundColor: '#374151', border: 'none',
                           borderRadius: '6px', color: '#d1d5db', cursor: 'pointer', fontSize: '13px' }}>
            キャンセル
          </button>
        </div>
      )}
    </>
  );

  /* ---- インラインモード（サイドバー内埋め込み） ---- */
  if (inline) {
    return (
      <>
        {commonParts}
        <div style={{ flex: 1, overflowY: 'auto', display: pickingLocation ? 'none' : undefined }}>
          <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #e5e7eb', marginBottom: '0' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              {isEdit ? '記録を編集' : '新規記録'}
            </h2>
          </div>
          {formBody}
        </div>
      </>
    );
  }

  /* ---- モーダルモード（overlay） ---- */
  return (
    <>
      {commonParts}
      <div style={{ ...overlay, display: pickingLocation ? 'none' : 'flex' }}
           onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
        <div style={modal}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              {isEdit ? '記録を編集' : '新規記録'}
            </h2>
            <button onClick={onCancel}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '24px' }}>
              <X size={20} />
            </button>
          </div>
          {formBody}
        </div>
      </div>
    </>
  );
}
