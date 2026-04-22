'use client';

import React, { useState } from 'react';
import { Printer, Download, X } from 'lucide-react';

interface PrintScreenshotModalProps {
    onClose: () => void;
}

export default function PrintScreenshotModal({ onClose }: PrintScreenshotModalProps) {
    const [isProcessing, setIsProcessing] = useState(false);

    const styles = {
        overlay: {
            position: 'fixed' as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)'
        },
        modal: {
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            position: 'relative' as const
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
        },
        title: {
            fontSize: '18px',
            fontWeight: '600' as const,
            color: '#1f2937',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        },
        closeButton: {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'background-color 0.2s'
        },
        content: {
            marginBottom: '24px'
        },
        description: {
            fontSize: '14px',
            color: '#6b7280',
            lineHeight: '1.6',
            marginBottom: '16px'
        },
        infoBox: {
            backgroundColor: '#f3f4f6',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#4b5563',
            lineHeight: '1.5'
        },
        buttonGroup: {
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
        },
        button: {
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '14px',
            fontWeight: '500' as const,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
            minWidth: '120px',
            justifyContent: 'center'
        },
        cancelButton: {
            backgroundColor: '#f3f4f6',
            color: '#374151'
        },
        screenshotButton: {
            backgroundColor: '#3b82f6',
            color: 'white'
        },
        screenshotButtonDisabled: {
            backgroundColor: '#9ca3af',
            cursor: 'not-allowed'
        }
    };

    const handleScreenshot = async () => {
        setIsProcessing(true);
        try {
            // html2canvasとjsPDFを動的にインポート
            const html2canvas = (await import('html2canvas')).default;
            const jsPDF = (await import('jspdf')).default;

            // メインコンテンツ領域をキャプチャ（ヘッダーを除外）
            const mainContent = document.querySelector('.mainContent') as HTMLElement;
            if (!mainContent) {
                throw new Error('メインコンテンツが見つかりませんでした');
            }

            // スクリーンショットを取得
            const canvas = await html2canvas(mainContent, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                scale: 2, // 高解像度
                logging: false,
                foreignObjectRendering: false, // SVG要素の正確なレンダリング
                ignoreElements: (element) => {
                    // HTMLElementにキャストして型エラーを回避
                    const htmlElement = element as HTMLElement;
                    // ポップアップやモーダルを除外（fixedのみ）
                    if (htmlElement.style && htmlElement.style.position === 'fixed') {
                        return true;
                    }
                    // モーダルクラスを持つ要素を除外
                    if (htmlElement.classList && (htmlElement.classList.contains('modal') || htmlElement.classList.contains('popup'))) {
                        return true;
                    }
                    return false;
                },
                onclone: (clonedDoc) => {
                    // クローンされたドキュメント内のinput[type="range"]を非表示に
                    const rangeInputs = clonedDoc.querySelectorAll('input[type="range"]');
                    rangeInputs.forEach((input: any) => {
                        // input要素を完全に非表示（赤いマーカーdivが代わりに表示される）
                        input.style.opacity = '0';
                        input.style.visibility = 'hidden';
                        input.style.width = '0';
                        input.style.height = '0';
                    });
                }
            });

            // PDFを作成
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height],
                compress: true
            });

            // キャンバスのサイズをそのまま使用（余白なし）
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height, undefined, 'FAST');

            // ファイル名に日時を含める
            const now = new Date();
            const filename = `map-screenshot-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.pdf`;

            pdf.save(filename);

            // 成功後にモーダルを閉じる
            setTimeout(() => {
                onClose();
            }, 500);

        } catch (error) {
            console.error('スクリーンショット取得エラー:', error);
            alert('スクリーンショットの取得に失敗しました。もう一度お試しください。');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h2 style={styles.title}>
                        <Printer size={20} />
                        画面印刷
                    </h2>
                    <button
                        style={styles.closeButton}
                        onClick={onClose}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={styles.content}>
                    <p style={styles.description}>
                        現在表示されている地図領域をPDFファイルとしてダウンロードします。
                    </p>
                    <div style={styles.infoBox}>
                        <strong>ご注意：</strong>
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                            <li>ヘッダー部分は印刷に含まれません</li>
                            <li>地図の表示内容がそのまま印刷されます</li>
                            <li>高解像度で出力されるため、処理に数秒かかる場合があります</li>
                        </ul>
                    </div>
                </div>

                <div style={styles.buttonGroup}>
                    <button
                        style={{ ...styles.button, ...styles.cancelButton }}
                        onClick={onClose}
                        disabled={isProcessing}
                        onMouseEnter={(e) => {
                            if (!isProcessing) e.currentTarget.style.backgroundColor = '#e5e7eb';
                        }}
                        onMouseLeave={(e) => {
                            if (!isProcessing) e.currentTarget.style.backgroundColor = '#f3f4f6';
                        }}
                    >
                        キャンセル
                    </button>
                    <button
                        style={{
                            ...styles.button,
                            ...styles.screenshotButton,
                            ...(isProcessing ? styles.screenshotButtonDisabled : {})
                        }}
                        onClick={handleScreenshot}
                        disabled={isProcessing}
                        onMouseEnter={(e) => {
                            if (!isProcessing) e.currentTarget.style.backgroundColor = '#2563eb';
                        }}
                        onMouseLeave={(e) => {
                            if (!isProcessing) e.currentTarget.style.backgroundColor = '#3b82f6';
                        }}
                    >
                        {isProcessing ? (
                            <>処理中...</>
                        ) : (
                            <>
                                <Download size={16} />
                                スクリーンショット
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
