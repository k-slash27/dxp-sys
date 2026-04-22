/**
 * GeoServerキャッシュ管理ユーティリティ
 * 農地オルソレイヤーの24時間キャッシュクリア機能
 */

import React from 'react';

interface CacheEntry {
    key: string;
    timestamp: number;
    layerType: 'ortho' | 'grid' | 'sensor' | 'water' | 'other';
    workspace?: string;
}

const CACHE_PREFIX = 'geoserver_cache_';
const ORTHO_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24時間（ミリ秒）

class CacheManager {
    private readonly storageKey = `${CACHE_PREFIX}entries`;

    /**
     * キャッシュエントリを記録
     */
    recordCacheEntry(key: string, layerType: CacheEntry['layerType'], workspace?: string): void {
        const entry: CacheEntry = {
            key,
            timestamp: Date.now(),
            layerType,
            workspace
        };

        const existingEntries = this.getCacheEntries();
        const updatedEntries = existingEntries.filter(e => e.key !== key);
        updatedEntries.push(entry);

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(updatedEntries));
        } catch (error) {
            console.warn('キャッシュエントリの保存に失敗:', error);
        }
    }

    /**
     * 保存されているキャッシュエントリを取得
     */
    private getCacheEntries(): CacheEntry[] {
        try {
            const entries = localStorage.getItem(this.storageKey);
            return entries ? JSON.parse(entries) : [];
        } catch (error) {
            console.warn('キャッシュエントリの読み込みに失敗:', error);
            return [];
        }
    }

    /**
     * 期限切れの農地オルソキャッシュをクリア
     */
    clearExpiredOrthoCache(): Promise<number> {
        return new Promise((resolve) => {
            const entries = this.getCacheEntries();
            const now = Date.now();
            let clearCount = 0;

            // 24時間経過した農地オルソキャッシュを特定
            const expiredOrthoEntries = entries.filter(entry => 
                entry.layerType === 'ortho' && 
                (now - entry.timestamp) > ORTHO_CACHE_DURATION
            );

            if (expiredOrthoEntries.length === 0) {
                resolve(0);
                return;
            }

            // Service Workerが利用可能な場合
            if ('serviceWorker' in navigator && 'caches' in window) {
                this.clearCachesViaServiceWorker(expiredOrthoEntries)
                    .then(count => {
                        this.removeExpiredEntries(expiredOrthoEntries);
                        resolve(count);
                    })
                    .catch(() => {
                        // Service Workerでの削除失敗時はフォールバック
                        clearCount = this.clearCachesViaFallback(expiredOrthoEntries);
                        this.removeExpiredEntries(expiredOrthoEntries);
                        resolve(clearCount);
                    });
            } else {
                // フォールバック方式でキャッシュクリア
                clearCount = this.clearCachesViaFallback(expiredOrthoEntries);
                this.removeExpiredEntries(expiredOrthoEntries);
                resolve(clearCount);
            }
        });
    }

    /**
     * Service Worker経由でのキャッシュクリア
     */
    private async clearCachesViaServiceWorker(entries: CacheEntry[]): Promise<number> {
        const cacheNames = await caches.keys();
        let clearCount = 0;

        for (const entry of entries) {
            // オルソレイヤーのキャッシュ名パターンをマッチング
            const orthoPattern = new RegExp(`${entry.workspace}.*ortho.*${entry.key.split('/').pop()}`);
            
            for (const cacheName of cacheNames) {
                if (orthoPattern.test(cacheName)) {
                    const cache = await caches.open(cacheName);
                    const keys = await cache.keys();
                    
                    for (const request of keys) {
                        if (request.url.includes('ortho') && request.url.includes(entry.workspace || '')) {
                            await cache.delete(request);
                            clearCount++;
                        }
                    }
                }
            }
        }

        return clearCount;
    }

    /**
     * フォールバック方式でのキャッシュクリア（強制リロード）
     */
    private clearCachesViaFallback(entries: CacheEntry[]): number {
        // ブラウザキャッシュを無効化するため、タイムスタンプ付きでURLを変更
        const timestamp = Date.now();
        entries.forEach(entry => {
            if (entry.layerType === 'ortho') {
                // URLにタイムスタンプを追加してキャッシュバスティング
                const originalUrl = entry.key;
                const bustingUrl = `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}_t=${timestamp}`;
                
                // 次回アクセス時にキャッシュバスティングされたURLを使用するようマーク
                localStorage.setItem(`${CACHE_PREFIX}bust_${entry.key}`, timestamp.toString());
            }
        });

        return entries.length;
    }

    /**
     * 期限切れエントリをローカルストレージから削除
     */
    private removeExpiredEntries(expiredEntries: CacheEntry[]): void {
        const allEntries = this.getCacheEntries();
        const expiredKeys = new Set(expiredEntries.map(e => e.key));
        const remainingEntries = allEntries.filter(e => !expiredKeys.has(e.key));

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(remainingEntries));
        } catch (error) {
            console.warn('期限切れエントリの削除に失敗:', error);
        }
    }

    /**
     * 手動でのキャッシュクリア（全農地オルソ）
     */
    async clearAllOrthoCache(): Promise<number> {
        const entries = this.getCacheEntries();
        const orthoEntries = entries.filter(entry => entry.layerType === 'ortho');
        
        if (orthoEntries.length === 0) {
            return 0;
        }

        let clearCount = 0;
        if ('caches' in window) {
            clearCount = await this.clearCachesViaServiceWorker(orthoEntries);
        } else {
            clearCount = this.clearCachesViaFallback(orthoEntries);
        }

        this.removeExpiredEntries(orthoEntries);
        return clearCount;
    }

    /**
     * キャッシュバスティング用URLの取得
     */
    getBustingUrl(originalUrl: string): string {
        const bustingTimestamp = localStorage.getItem(`${CACHE_PREFIX}bust_${originalUrl}`);
        if (bustingTimestamp) {
            // 一度使用したバスティングタイムスタンプを削除
            localStorage.removeItem(`${CACHE_PREFIX}bust_${originalUrl}`);
            return `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}_t=${bustingTimestamp}`;
        }
        return originalUrl;
    }

    /**
     * 定期的な自動クリーンアップの開始
     */
    startPeriodicCleanup(intervalMinutes: number = 60): NodeJS.Timeout {
        return setInterval(async () => {
            try {
                const clearedCount = await this.clearExpiredOrthoCache();
                if (clearedCount > 0) {
                    console.log(`農地オルソキャッシュ自動クリア: ${clearedCount}件`);
                }
            } catch (error) {
                console.warn('定期キャッシュクリーンアップエラー:', error);
            }
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * キャッシュ統計情報の取得
     */
    getCacheStats(): {
        total: number;
        ortho: number;
        expired: number;
        storageUsed: number;
    } {
        const entries = this.getCacheEntries();
        const now = Date.now();
        const orthoEntries = entries.filter(e => e.layerType === 'ortho');
        const expiredEntries = entries.filter(e => 
            e.layerType === 'ortho' && (now - e.timestamp) > ORTHO_CACHE_DURATION
        );

        let storageUsed = 0;
        try {
            const storageData = localStorage.getItem(this.storageKey);
            storageUsed = storageData ? new Blob([storageData]).size : 0;
        } catch (error) {
            console.warn('ストレージ使用量の計算に失敗:', error);
        }

        return {
            total: entries.length,
            ortho: orthoEntries.length,
            expired: expiredEntries.length,
            storageUsed
        };
    }
}

// シングルトンインスタンス
export const cacheManager = new CacheManager();

// 自動クリーンアップ用のフック
export const useCacheCleanup = (enableAutoCleanup: boolean = true) => {
    React.useEffect(() => {
        if (!enableAutoCleanup) return;

        // 初回実行
        cacheManager.clearExpiredOrthoCache().then(count => {
            if (count > 0) {
                console.log(`初回キャッシュクリア: ${count}件`);
            }
        });

        // 定期実行（1時間間隔）
        const cleanupInterval = cacheManager.startPeriodicCleanup(60);

        return () => {
            clearInterval(cleanupInterval);
        };
    }, [enableAutoCleanup]);

    return {
        clearExpiredCache: () => cacheManager.clearExpiredOrthoCache(),
        clearAllCache: () => cacheManager.clearAllOrthoCache(),
        getCacheStats: () => cacheManager.getCacheStats()
    };
};