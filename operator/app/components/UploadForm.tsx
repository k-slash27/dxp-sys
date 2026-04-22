'use client';

import React, { useState, useEffect, useId } from 'react';

type Area = {
  id: string;
  label: string;
  workspace: string;
  storagePath: string;
  contact: { contactOrganization: string | null };
};

type ProgressState = {
  percent: number;
  message: string;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
};

export default function UploadForm({ onUploaded }: { onUploaded?: () => void }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [shootingDate, setShootingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<ProgressState>({ percent: 0, message: '', status: 'idle' });

  const messageId = useId();
  const uploading = progress.status === 'uploading' || progress.status === 'processing';

  useEffect(() => {
    fetch('/operator/api/areas')
      .then((r) => r.json())
      .then((data: Area[]) => {
        setAreas(data);
        if (data.length > 0) setSelectedAreaId(data[0].id);
      })
      .catch(() => setMessage('撮影エリアの取得に失敗しました'));
  }, []);

  const selectedArea = areas.find((a) => a.id === selectedAreaId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().match(/\.tiff?$/)) {
      setMessage('GeoTiffファイル（.tif, .tiff）のみアップロード可能です');
      setFile(null);
      return;
    }
    setFile(f);
    setMessage('');
  };

  const handleUpload = async () => {
    console.log('[upload] handleUpload called', { file: file?.name, selectedAreaId, selectedArea });
    if (!file || !selectedAreaId) {
      console.warn('[upload] early return: file or selectedAreaId missing');
      return;
    }

    setProgress({ percent: 10, message: 'ファイルを送信中...', status: 'uploading' });
    setMessage('');

    try {
      const workspace = selectedArea?.workspace;
      if (!workspace) {
        throw new Error(`selectedArea が見つかりません: id=${selectedAreaId}`);
      }
      const fd = new FormData();
      fd.append('file', file);
      fd.append('workspace', workspace);
      fd.append('date', shootingDate);

      console.log('[upload] calling fetch POST /api/upload, file size:', file.size);
      const res = await fetch('/operator/api/upload', { method: 'POST', body: fd });
      console.log('[upload] fetch response:', res.status, res.url, res.redirected);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'アップロードに失敗しました');
      }

      const text = await res.text();
      console.log('[upload] response body:', text);
      const result = JSON.parse(text);
      console.log('[upload] result:', result);
      const taskId = result.task_id;

      setProgress({ percent: 60, message: 'GeoServerに登録中...', status: 'processing' });

      // SSE で進捗を購読
      if (taskId) {
        console.log('[upload] opening SSE for taskId:', taskId);
        const sse = new EventSource(`/operator/api/progress/${taskId}`);
        sse.onmessage = (ev) => {
          const data = JSON.parse(ev.data);
          if (data.status === 'completed') {
            setProgress({ percent: 100, message: '登録完了', status: 'completed' });
            setMessage(`登録完了: ${file.name}`);
            setFile(null);
            sse.close();
            onUploaded?.();
          } else if (data.status === 'failed') {
            setProgress({ percent: 0, message: data.message, status: 'failed' });
            setMessage(`エラー: ${data.message}`);
            sse.close();
          } else {
            setProgress((p) => ({ ...p, message: data.message }));
          }
        };
        sse.onerror = () => {
          // SSEが切れた場合はresultで完了判定
          if (result.status === 'completed') {
            setProgress({ percent: 100, message: '登録完了', status: 'completed' });
            setMessage(`登録完了: ${file.name}`);
            setFile(null);
            onUploaded?.();
          }
          sse.close();
        };
      } else {
        // task_id なし（同期完了）
        setProgress({ percent: 100, message: '登録完了', status: 'completed' });
        setMessage(`登録完了: ${file.name}`);
        setFile(null);
        onUploaded?.();
      }
    } catch (err) {
      console.error('[upload] error caught:', err);
      setProgress({ percent: 0, message: '', status: 'failed' });
      setMessage(`エラー: ${err instanceof Error ? err.message : '不明なエラー'}`);
    }
  };

  const isError = message.includes('エラー') || message.includes('のみ') || message.includes('失敗');
  const canUpload = !!file && !uploading && !!selectedAreaId;

  return (
    <section aria-label="ファイルアップロード" className="glass-card">
      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* 撮影エリア */}
        <div>
          <label htmlFor="area-select" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#18181b', marginBottom: '6px' }}>
            撮影エリア
          </label>
          <select
            id="area-select"
            value={selectedAreaId}
            onChange={(e) => setSelectedAreaId(e.target.value)}
            disabled={uploading || areas.length === 0}
            className="form-input"
            style={{ opacity: (uploading || areas.length === 0) ? 0.5 : 1 }}
          >
            {areas.length === 0 && <option value="">読み込み中...</option>}
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.contact.contactOrganization ?? a.label}
              </option>
            ))}
          </select>
          {selectedArea && (
            <dl className="info-panel" style={{ marginTop: '8px', lineHeight: '1.9' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <dt style={{ fontWeight: '500' }}>ワークスペース：</dt>
                <dd style={{ margin: 0 }}>{selectedArea.workspace}</dd>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <dt style={{ fontWeight: '500' }}>格納先：</dt>
                <dd style={{ margin: 0, wordBreak: 'break-all' }}>{selectedArea.storagePath}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* 撮影日 */}
        <div>
          <label htmlFor="shooting-date" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#18181b', marginBottom: '6px' }}>
            撮影日
          </label>
          <input
            id="shooting-date"
            type="date"
            value={shootingDate}
            onChange={(e) => setShootingDate(e.target.value)}
            disabled={uploading}
            className="form-input"
            style={{ opacity: uploading ? 0.5 : 1 }}
          />
        </div>

        {/* ファイル選択 */}
        <div>
          <label htmlFor="file-input" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#18181b', marginBottom: '6px' }}>
            GeoTiffファイル (.tif, .tiff)
          </label>
          <input
            id="file-input"
            type="file"
            accept=".tif,.tiff"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 disabled:opacity-50"
            style={{ border: '1.5px solid #a1a1aa', borderRadius: '7px', padding: '7px 10px', backgroundColor: '#ffffff', fontSize: '13px' }}
          />
          {file && (
            <div aria-live="polite" className="info-panel" style={{ marginTop: '8px' }}>
              <p style={{ fontSize: '12px', fontWeight: '500' }}>{file.name}</p>
              <p style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '2px' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <p style={{ fontSize: '12px', color: '#71717a', marginTop: '6px' }}>
                <span style={{ fontWeight: '500' }}>登録ファイル名：</span>ortho_{shootingDate.replace(/-/g, '')}.tif
              </p>
            </div>
          )}
        </div>

        {/* 進捗バー */}
        {progress.status !== 'idle' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#71717a', marginBottom: '4px' }}>
              <span>{progress.message}</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        )}

        {/* アップロードボタン */}
        <button
          onClick={handleUpload}
          disabled={!canUpload}
          aria-busy={uploading}
          className="btn-primary"
          style={{ width: '100%', fontSize: '14px', padding: '11px 16px' }}
        >
          {uploading ? 'アップロード中...' : 'アップロード'}
        </button>

        {/* メッセージ */}
        {message && (
          <div
            id={messageId}
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              gap: '7px',
              border: `1.5px solid ${isError ? '#fca5a5' : '#6ee7b7'}`,
              backgroundColor: isError ? '#fef2f2' : '#f0fdf4',
              color: isError ? '#991b1b' : '#065f46',
            }}
          >
            <span>{isError ? '⚠' : '✓'}</span>
            <span>{message}</span>
          </div>
        )}
      </div>
    </section>
  );
}
