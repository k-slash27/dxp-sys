'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Map, Satellite, Globe, Mountain, TrendingUp } from 'lucide-react';

interface BasemapOption {
  id: string;
  name: string;
  thumbnail: string;
}

const styles: Record<string, React.CSSProperties> = {
  switcherContainer: {
    position: 'absolute',
    display: 'flex',
    gap: '5px',
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 999,
  },
  mapButton: {
    padding: 0,
    width: '78px',
    borderRadius: '8px',
    border: 'solid 3px transparent',
    boxShadow: '4px 0 8px rgba(0, 0, 0, 0.15)',
    cursor: 'pointer',
  },
  mapSumbnail: {
    width: '100%',
    height: '60px',
    borderRadius: '6px 6px 0 0',
  },
  selected : {
    border: 'solid 3px #3b82f6', // blue-500
  }
}

const BasemapSwitcher = (props) => {

    const {
        visibility,
        toggleBaseMap,
    } = props;

  const [selectedBasemap, setSelectedBasemap] = useState('standard');

  const basemapOptions: BasemapOption[] = [
    {
      id: 'standard',
      name: 'OSM標準',
      thumbnail: '/basemaps/standard.png', // public/images/basemaps/に配置
    },
    {
      id: 'baseOrtho',
      name: '航空写真',
      thumbnail: '/basemaps/satellite.png',
    },
    {
      id: 'baseGsi',
      name: '国土地理院',
      thumbnail: '/basemaps/gsi.png',
    },
    // {
    //   id: 'baseWaterLevel',
    //   name: '水路マップ',
    //   thumbnail: '/basemaps/waterOrtho.png',
    // },
  ];

  const handleBasemapSelect = (basemapId: string) => {
    setSelectedBasemap(basemapId);

    toggleBaseMap('baseOrtho', false);
    toggleBaseMap('baseGsi', false);
    toggleBaseMap('baseWaterLevel', false);

    if (basemapId ==='standard') return;

    toggleBaseMap(basemapId, true);
  };

  return (
    <div style={styles.switcherContainer}>
      {basemapOptions.map((option) => (
        <button
          key={option.id}
          onClick={() => handleBasemapSelect(option.id)}
          style={{...styles.mapButton, ...selectedBasemap === option.id ? styles.selected : {}}}
          title={option.name}
          type="button"
          aria-pressed={selectedBasemap === option.id}
          aria-label={`${option.name}を選択`}
        >
          {/* サムネイル */}
          <div>
            <Image
              style={styles.mapSumbnail}
              src={option.thumbnail}
              alt={`${option.name}のプレビュー`}
              width={72}
              height={60}
              className={`object-cover rounded border ${
                selectedBasemap === option.id
                  ? 'border-blue-300'
                  : 'border-gray-200'
              }`}
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8A0XqN7s2vV6jc7Nr1eo3OzKKBEgQNsN"
            />
          </div>
          
          {/* ラベル */}
          <span className={`text-xs font-medium leading-tight text-center ${
            selectedBasemap === option.id
              ? 'text-blue-700'
              : 'text-gray-600'
          }`}>
            {option.name}
          </span>
          
          {/* 選択インジケーター */}
          {selectedBasemap === option.id && (
            <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};

export default BasemapSwitcher;