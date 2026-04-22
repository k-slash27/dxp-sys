'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import UploadForm from '../components/UploadForm';
import GranuleList from '../components/GranuleList';

type Area = { id: string; label: string; workspace: string; contact: { contactOrganization: string | null } };

export default function DashboardPage() {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/operator/api/areas')
      .then((r) => r.json())
      .then((data: Area[]) => {
        setAreas(data);
        if (data.length > 0) setSelectedWorkspace(data[0].workspace);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="page-bg">
      <nav className="glass-nav" role="navigation" aria-label="メインナビゲーション">
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '52px' }}>
          <h1 style={{ fontSize: '14px', fontWeight: '700', color: '#333', letterSpacing: '-0.2px' }}>
            DXP Operator
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '13px', color: '#71717a', fontWeight: '500' }}>{user?.username}</span>
            <button onClick={logout} className="btn-primary" style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '7px' }}>
              ログアウト
            </button>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 24px', color: '#333' }}>
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>
            GeoTiffファイル管理
          </h2>
          <p style={{ marginTop: '8px', fontSize: '13px', color: '#444', lineHeight: '1.5' }}>
            撮影したGeoTiff画像をアップロードし、GeoServerのImageMosaicに自動登録します。
            DataSync・S3 を使わず共有ボリューム経由で即時反映されます。
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          {/* アップロードフォーム */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: '#18181b' }}>
              アップロード
            </h3>
            <UploadForm onUploaded={() => setRefreshKey((k) => k + 1)} />
          </div>

          {/* granule 一覧 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#18181b', margin: 0 }}>
                登録済みファイル
              </h3>
              {areas.length > 1 && (
                <select
                  value={selectedWorkspace}
                  onChange={(e) => setSelectedWorkspace(e.target.value)}
                  style={{ fontSize: '12px', padding: '4px 8px', border: '1px solid #a1a1aa', borderRadius: '6px', backgroundColor: '#fff' }}
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.workspace}>
                      {a.contact.contactOrganization ?? a.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <GranuleList workspace={selectedWorkspace} refreshKey={refreshKey} />
          </div>
        </div>
      </main>
    </div>
  );
}
