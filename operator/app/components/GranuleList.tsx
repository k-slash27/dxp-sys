'use client';

import React, { useState, useEffect, useCallback } from 'react';

type Granule = {
  id: string;
  location: string;
  ingestion: string;
};

type EditState = {
  granuleId: string;
  newDate: string; // YYYY-MM-DD
};

// ortho_YYYYMMDD.tif → YYYY-MM-DD
const filenameToDate = (name: string): string => {
  const m = name.match(/ortho_(\d{4})(\d{2})(\d{2})\.tif/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
};

// YYYY-MM-DD → ortho_YYYYMMDD.tif
const dateToFilename = (date: string): string => `ortho_${date.replace(/-/g, '')}.tif`;

export default function GranuleList({ workspace, refreshKey }: { workspace: string; refreshKey?: number }) {
  const [granules, setGranules] = useState<Granule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const fetchGranules = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/operator/api/granules?workspace=${encodeURIComponent(workspace)}`);
      if (!res.ok) throw new Error(`取得失敗 (${res.status})`);
      const data = await res.json();
      setGranules(data.granules ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得失敗');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => { fetchGranules(); }, [fetchGranules, refreshKey]);

  const handleDelete = async (granuleId: string) => {
    try {
      const res = await fetch('/operator/api/granules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace, granule_id: granuleId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '削除失敗');
      }
      setActionMsg('削除しました');
      setDeleteConfirm(null);
      fetchGranules();
    } catch (e) {
      setActionMsg(`エラー: ${e instanceof Error ? e.message : '削除失敗'}`);
    }
  };

  const handleUpdate = async () => {
    if (!editState) return;
    try {
      const res = await fetch('/operator/api/granules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace,
          granule_id: editState.granuleId,
          new_filename: dateToFilename(editState.newDate),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '更新失敗');
      }
      setActionMsg('日付を変更しました');
      setEditState(null);
      fetchGranules();
    } catch (e) {
      setActionMsg(`エラー: ${e instanceof Error ? e.message : '更新失敗'}`);
    }
  };

  const filename = (location: string) => location.split('/').pop() ?? location;
  const isError = actionMsg.startsWith('エラー');

  return (
    <section aria-label="登録済みgranule一覧" className="glass-card">
      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#18181b' }}>
            登録済み granule
            {!loading && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#71717a', fontWeight: '400' }}>({granules.length}件)</span>}
          </h3>
          <button onClick={fetchGranules} style={{ fontSize: '12px', color: '#059669', background: 'none', border: 'none', fontWeight: '600' }}>
            更新
          </button>
        </div>

        {loading && <p style={{ fontSize: '13px', color: '#71717a' }}>読み込み中...</p>}
        {error && <p style={{ fontSize: '13px', color: '#dc2626' }}>⚠ {error}</p>}

        {!loading && granules.length === 0 && (
          <p style={{ fontSize: '13px', color: '#a1a1aa', textAlign: 'center', padding: '20px 0' }}>
            登録されたファイルはありません
          </p>
        )}

        {granules.map((g) => (
          <div key={g.id} className="info-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#18181b', wordBreak: 'break-all' }}>{filename(g.location)}</p>
                <p style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>ingestion: {g.ingestion}</p>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                <button
                  onClick={() => setEditState({ granuleId: g.id, newDate: filenameToDate(filename(g.location)) })}
                  style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid #a1a1aa', borderRadius: '5px', background: '#fff', color: '#3f3f46' }}
                >
                  日付変更
                </button>
                <button
                  onClick={() => setDeleteConfirm(g.id)}
                  className="btn-danger"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  削除
                </button>
              </div>
            </div>

            {/* 削除確認 */}
            {deleteConfirm === g.id && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '12px', color: '#991b1b', fontWeight: '500' }}>
                  このファイルを削除しますか？（元に戻せません）
                </p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleDelete(g.id)} className="btn-danger" style={{ fontSize: '12px', padding: '5px 12px' }}>削除する</button>
                  <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid #a1a1aa', borderRadius: '6px', background: '#fff' }}>キャンセル</button>
                </div>
              </div>
            )}

            {/* 日付変更フォーム */}
            {editState?.granuleId === g.id && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#065f46' }}>
                  撮影日
                </label>
                <input
                  type="date"
                  value={editState.newDate}
                  onChange={(e) => setEditState({ ...editState, newDate: e.target.value })}
                  className="form-input"
                  style={{ fontSize: '13px' }}
                  placeholder="ortho_20240601.tif"
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleUpdate} className="btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }}>変更する</button>
                  <button onClick={() => setEditState(null)} style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid #a1a1aa', borderRadius: '6px', background: '#fff' }}>キャンセル</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {actionMsg && (
          <div
            role="alert"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              display: 'flex',
              gap: '6px',
              border: `1px solid ${isError ? '#fca5a5' : '#6ee7b7'}`,
              backgroundColor: isError ? '#fef2f2' : '#f0fdf4',
              color: isError ? '#991b1b' : '#065f46',
            }}
          >
            <span>{isError ? '⚠' : '✓'}</span>
            <span>{actionMsg}</span>
          </div>
        )}
      </div>
    </section>
  );
}
