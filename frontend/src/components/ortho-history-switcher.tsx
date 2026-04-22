'use client';

import React, { useState, useEffect, useRef } from 'react';

interface OrthoHistoryDate {
  date: string;
  layerName: string;
  displayName: string;
}

interface OrthoHistorySwitcherProps {
  onDateChange: (layerName: string) => void;
  availableDates?: OrthoHistoryDate[];
  currentWorkspace: string;
}

export default function OrthoHistorySwitcher({
  onDateChange,
  availableDates,
  currentWorkspace
}: OrthoHistorySwitcherProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dates, setDates] = useState<OrthoHistoryDate[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (availableDates && availableDates.length > 0) {
      setDates(availableDates);
      setCurrentIndex(0);
    } else {
      setDates([
        { date: '2025-08-13', layerName: 'vtol-ortho-layer', displayName: '2025年08月13日' },
        { date: '2025-07-05', layerName: 'vtol-ortho-layer-20250705', displayName: '2025年07月05日' },
      ]);
    }
  }, [availableDates, currentWorkspace]);

  if (dates.length === 0) return null;

  // データ範囲から軸を生成（最古の月初〜最新の月末）
  const dateTimes = dates.map(d => new Date(d.date).getTime());
  const minTime = Math.min(...dateTimes);
  const maxTime = Math.max(...dateTimes);
  const startDate = new Date(new Date(minTime).getFullYear(), new Date(minTime).getMonth(), 1);
  const endRaw = new Date(maxTime);
  const endDate = new Date(endRaw.getFullYear(), endRaw.getMonth() + 1, 0);
  const totalDuration = endDate.getTime() - startDate.getTime();

  const toPercent = (dateString: string) => {
    const time = new Date(dateString).getTime();
    if (totalDuration === 0) return 50;
    return Math.max(0, Math.min(100, ((time - startDate.getTime()) / totalDuration) * 100));
  };

  const dateToPercent = (d: Date) => {
    if (totalDuration === 0) return 50;
    return Math.max(0, Math.min(100, ((d.getTime() - startDate.getTime()) / totalDuration) * 100));
  };

  // 月ラベル生成
  const axisMonths: { year: number; month: number }[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    axisMonths.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // 月ごとの帯（交互に色付け）
  const monthBands = axisMonths.map((m, i) => {
    const bandStart = new Date(m.year, m.month - 1, 1);
    const bandEnd = new Date(m.year, m.month, 1);
    return {
      left: dateToPercent(bandStart),
      width: dateToPercent(bandEnd) - dateToPercent(bandStart),
      even: i % 2 === 0,
    };
  });

  // 月ラベルの位置（各月帯の中央）
  const monthToPercent = (idx: number) => {
    const band = monthBands[idx];
    return band.left + band.width / 2;
  };

  // 月数が多い場合は間引き
  const maxLabels = 8;
  const step = axisMonths.length <= maxLabels ? 1 : Math.ceil(axisMonths.length / maxLabels);

  const currentPos = toPercent(dates[currentIndex].date);
  const currentDateObj = new Date(dates[currentIndex].date);

  // 1ヶ月あたり70px、最小は100%（CSSのmax()で制御）
  const minWidthPx = axisMonths.length * 70;

  const sliderThumbCSS = `
    .ortho-slider::-webkit-slider-thumb {
      appearance: none; width: 8px; height: 32px;
      border-radius: 2px; background: transparent; cursor: pointer;
    }
    .ortho-slider::-moz-range-thumb {
      width: 8px; height: 32px;
      border-radius: 2px; background: transparent; cursor: pointer;
    }
  `;

  return (
    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
      <style>{sliderThumbCSS}</style>

      {/* 横スクロールコンテナ */}
      <div
        ref={scrollRef}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingTop: '22px',
          paddingBottom: '4px',
          paddingRight: '30px',
          paddingLeft: '30px',
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db transparent',
        }}
      >
        {/* タイムライン本体：月数に応じて幅が伸びる */}
        <div style={{ minWidth: `max(100%, ${minWidthPx}px)`, position: 'relative' }}>

          {/* 選択中ツールチップ */}
          <div style={{
            position: 'absolute',
            left: `${currentPos}%`,
            transform: 'translateX(-50%)',
            top: '-44px',
            backgroundColor: '#d1d5db',
            color: '#374151',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            pointerEvents: 'none',
          }}>
            {currentDateObj.getFullYear()}/{currentDateObj.getMonth() + 1}/{currentDateObj.getDate()}
          </div>
          {/* ツールチップ矢印 */}
          <div style={{
            position: 'absolute',
            left: `${currentPos}%`,
            transform: 'translateX(-50%)',
            top: '-16px',
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #d1d5db',
            pointerEvents: 'none',
          }} />

          {/* 月ごとの背景帯 */}
          {monthBands.map((band, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${band.left}%`,
              width: `${band.width}%`,
              top: '-45px',
              height: '82px',
              background: band.even ? 'rgba(209, 213, 219, 0.2)' : 'transparent',
              pointerEvents: 'none',
              zIndex: '-1',
            }} />
          ))}

          {/* 軸バー */}
          <div style={{
            position: 'absolute',
            top: '6px',
            left: '0',
            right: '0',
            height: '4px',
            background: 'linear-gradient(90deg, #374151 0%, #6b7280 50%, #374151 100%)',
            borderRadius: '2px',
          }} />


          {/* 赤いマーカー */}
          <div style={{
            position: 'absolute',
            left: `${currentPos}%`,
            transform: 'translateX(-50%)',
            top: '-8px',
            width: '8px',
            height: '32px',
            borderRadius: '2px',
            background: '#dc2626',
            pointerEvents: 'none',
            zIndex: 10,
          }} />

          {/* データポイントのティック */}
          {dates.map((date, index) => (
            <div key={index} style={{
              position: 'absolute',
              left: `${toPercent(date.date)}%`,
              transform: 'translateX(-50%)',
              top: '-2px',
              width: '3px',
              height: '20px',
              background: index === currentIndex ? '#dc2626' : '#6b7280',
              borderRadius: '1.5px',
              zIndex: 5,
            }} />
          ))}

          {/* スライダー（操作用・透明） */}
          <input
            className="ortho-slider"
            type="range"
            min="0"
            max="100"
            value={currentPos}
            onChange={(e) => {
              const target = parseFloat(e.target.value);
              let closest = 0;
              let minDist = Math.abs(toPercent(dates[0].date) - target);
              dates.forEach((date, i) => {
                const d = Math.abs(toPercent(date.date) - target);
                if (d < minDist) { minDist = d; closest = i; }
              });
              setCurrentIndex(closest);
              onDateChange(dates[closest].layerName);
            }}
            style={{
              position: 'absolute',
              top: '-2px',
              left: '0',
              right: '0',
              width: '100%',
              height: '20px',
              background: 'transparent',
              appearance: 'none',
              cursor: 'pointer',
              zIndex: 15,
              margin: 0,
              padding: 0,
            }}
          />

          {/* 月ラベル（ティックの下に配置するため余白） */}
          <div style={{ height: '30px', position: 'relative', marginTop: '22px' }}>
            {axisMonths.map((m, i) => {
              if (i % step !== 0 && i !== axisMonths.length - 1) return null;
              return (
                <div key={i} style={{
                  position: 'absolute',
                  left: `${monthToPercent(i)}%`,
                  transform: 'translateX(-50%)',
                  top: '20px',
                  fontSize: '11px',
                  color: '#6b7280',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                }}>
                  {`${m.year}/${String(m.month).padStart(2, '0')}`}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
