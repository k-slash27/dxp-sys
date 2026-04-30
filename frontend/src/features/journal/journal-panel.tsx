import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, Plus, Download, MapPin, Camera, ChevronRight, Trash2 } from 'lucide-react';
import JournalForm from './journal-form';

interface JournalEntry {
  id: string;
  workspace: string;
  record_date: string;
  text_content: string | null;
  photos: { filename: string; url: string }[];
  location: { lat: number; lng: number } | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface JournalPanelProps {
  workspace: string;
  userInfo: any;
  onClose: () => void;
  /** trueのとき地図クリックで位置を取得するモード */
  pickingLocation: boolean;
  /** 地図クリック位置取得モードを開始する */
  onRequestLocationPick: () => void;
  /** 地図クリック位置取得モードをキャンセルする */
  onCancelLocationPick: () => void;
  /** 地図クリックで取得された座標（nullで選択解除） */
  pickedLocation: { lat: number; lng: number } | null;
  /** 座標の消費（フォームが受け取ったら呼ぶ） */
  onLocationConsumed: () => void;
}

const PHOTO_BASE = '/api/register/journal/photos';

export default function JournalPanel({
  workspace,
  userInfo,
  onClose,
  pickingLocation,
  onRequestLocationPick,
  onCancelLocationPick,
  pickedLocation,
  onLocationConsumed,
}: JournalPanelProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // fromDate/toDate を ref でも保持（useEffect の stale closure を回避）
  const fromDateRef = useRef(fromDate);
  const toDateRef   = useRef(toDate);
  useEffect(() => { fromDateRef.current = fromDate; }, [fromDate]);
  useEffect(() => { toDateRef.current   = toDate;   }, [toDate]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const params = new URLSearchParams({ workspace });
      if (fromDateRef.current) params.set('from_date', fromDateRef.current);
      if (toDateRef.current)   params.set('to_date',   toDateRef.current);
      const r = await fetch(`/api/journal?${params}`);
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`サーバーエラー (${r.status}): ${body}`);
      }
      const data = await r.json();
      setEntries(data.records ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setFetchError(err.message ?? '取得に失敗しました');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [workspace]); // workspace 変更時のみ再生成

  // workspace 変更 or フィルター適用 で再フェッチ
  const [filterVersion, setFilterVersion] = useState(0);
  useEffect(() => { fetchEntries(); }, [fetchEntries, filterVersion]);

  const applyFilter = () => {
    fromDateRef.current = fromDate;
    toDateRef.current   = toDate;
    setFilterVersion(v => v + 1);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditEntry(null);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この記録を削除しますか？写真も含めて削除されます。')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/journal/${id}`, { method: 'DELETE' });
      fetchEntries();
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams({ workspace });
    if (fromDate) params.set('from_date', fromDate);
    if (toDate)   params.set('to_date', toDate);
    window.open(`/api/journal/export?${params}`, '_blank');
  };

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '420px',
    height: '100vh',
    backgroundColor: '#1a1f2e',
    color: '#e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 2000,
    boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
    fontFamily: 'sans-serif',
    fontSize: '14px',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #2d3748',
    flexShrink: 0,
  };

  const filterStyle: React.CSSProperties = {
    padding: '12px 20px',
    borderBottom: '1px solid #2d3748',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
    flexShrink: 0,
  };

  const inputStyle: React.CSSProperties = {
    padding: '4px 8px',
    backgroundColor: '#2d3748',
    border: '1px solid #4a5568',
    borderRadius: '4px',
    color: '#e5e7eb',
    fontSize: '12px',
    flex: 1,
    minWidth: 0,
  };

  const btnStyle = (variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: variant === 'primary' ? '#3b82f6' : variant === 'danger' ? '#ef4444' : 'transparent',
    color: variant === 'ghost' ? '#9ca3af' : '#fff',
  });

  return (
    <>
      <div style={panelStyle}>
        {/* ヘッダー */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 600, fontSize: '16px' }}>生産者日誌</span>
            <span style={{ fontSize: '12px', color: '#9ca3af', backgroundColor: '#2d3748', padding: '2px 8px', borderRadius: '12px' }}>
              {total} 件
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button style={btnStyle('ghost')} onClick={handleExportCSV} title="CSVエクスポート">
              <Download size={14} />
            </button>
            <button style={btnStyle('primary')} onClick={() => { setEditEntry(null); setShowForm(true); }}>
              <Plus size={14} /> 新規作成
            </button>
            <button style={{ ...btnStyle('ghost'), padding: '6px' }} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* フィルター */}
        <div style={filterStyle}>
          <span style={{ fontSize: '12px', color: '#9ca3af', flexShrink: 0 }}>期間：</span>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={inputStyle}
          />
          <span style={{ color: '#6b7280', flexShrink: 0 }}>〜</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={inputStyle}
          />
          <button
            style={{ ...btnStyle('primary'), fontSize: '12px', padding: '4px 10px' }}
            onClick={applyFilter}
          >
            検索
          </button>
          <button
            style={{ ...btnStyle('ghost'), fontSize: '12px', padding: '4px 8px' }}
            onClick={() => { setFromDate(''); setToDate(''); fromDateRef.current = ''; toDateRef.current = ''; setFilterVersion(v => v + 1); }}
          >
            クリア
          </button>
        </div>

        {/* 一覧 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>読み込み中...</div>
          )}
          {fetchError && (
            <div style={{ margin: '12px', padding: '10px', backgroundColor: '#450a0a',
                          border: '1px solid #7f1d1d', borderRadius: '6px',
                          color: '#fca5a5', fontSize: '12px' }}>
              {fetchError}
            </div>
          )}
          {!loading && !fetchError && entries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              記録がありません
            </div>
          )}
          {!loading && entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              deleting={deletingId === entry.id}
              onEdit={() => { setEditEntry(entry); setShowForm(true); }}
              onDelete={() => handleDelete(entry.id)}
            />
          ))}
        </div>
      </div>

      {/* 作成/編集フォーム */}
      {showForm && (
        <JournalForm
          workspace={workspace}
          userInfo={userInfo}
          initialData={editEntry}
          pickingLocation={pickingLocation}
          onRequestLocationPick={onRequestLocationPick}
          onCancelLocationPick={onCancelLocationPick}
          pickedLocation={pickedLocation}
          onLocationConsumed={onLocationConsumed}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditEntry(null); }}
        />
      )}
    </>
  );
}

/* ---------- エントリーカード ---------- */

interface EntryCardProps {
  entry: JournalEntry;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function EntryCard({ entry, deleting, onEdit, onDelete }: EntryCardProps) {
  const [hovered, setHovered] = useState(false);

  const cardStyle: React.CSSProperties = {
    margin: '6px 12px',
    padding: '14px 16px',
    backgroundColor: hovered ? '#252d3d' : '#1e2637',
    borderRadius: '8px',
    border: '1px solid #2d3748',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    position: 'relative',
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
    >
      {/* 日付 + バッジ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontWeight: 600, color: '#93c5fd', fontSize: '14px' }}>
          {formatDate(entry.record_date)}
        </span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {entry.location && (
            <span style={badgeStyle('#065f46', '#6ee7b7')}>
              <MapPin size={10} /> 位置あり
            </span>
          )}
          {entry.photos.length > 0 && (
            <span style={badgeStyle('#1e3a5f', '#93c5fd')}>
              <Camera size={10} /> {entry.photos.length}枚
            </span>
          )}
        </div>
      </div>

      {/* テキスト */}
      {entry.text_content && (
        <p style={{ margin: 0, color: '#d1d5db', lineHeight: 1.5, fontSize: '13px',
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as any }}>
          {entry.text_content}
        </p>
      )}

      {/* フッター */}
      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>{entry.created_by}</span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
             onClick={e => e.stopPropagation()}>
          <button
            disabled={deleting}
            onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px',
                     display: 'flex', alignItems: 'center' }}
            title="削除"
          >
            <Trash2 size={13} />
          </button>
          <ChevronRight size={14} color="#6b7280" />
        </div>
      </div>
    </div>
  );
}

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  padding: '2px 6px',
  backgroundColor: bg,
  color,
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 500,
});

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
