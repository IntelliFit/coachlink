'use client';

import React, { useRef, useEffect } from 'react';
import { InputText } from 'primereact/inputtext';
import CityPicker from '@/components/CityPicker';
import TianDiTuMapPicker from '@/components/TianDiTuMapPicker';

/**
 * 地图选点组件统一的值类型，供表单或页面绑定
 * 省/市/区为三个独立字段，与后端存储一致。
 */
export interface MapLocationValue {
  province?: string;
  city?: string;
  county?: string;
  /** 详细地址（addressComponent.address + poi） */
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface MapLocationPickerProps {
  /** 当前选中的位置信息（受控） */
  value: MapLocationValue;
  /** 值变化时回调 */
  onChange: (value: MapLocationValue) => void;
  /** 是否显示省市区选择器，默认 true */
  showCityPicker?: boolean;
  /** 是否显示详细地址输入框，默认 true */
  showAddressInput?: boolean;
  /** 是否显示“重新定位”按钮；为 true 时需传入 onRelocate，默认 true */
  showRelocateButton?: boolean;
  /** 点击“重新定位”时由父组件获取当前位置并通过 onChange 更新 */
  onRelocate?: () => void;
  /** 是否必须有省市区才显示地图（false 时无 city 也可显示地图，用默认中心），默认 true */
  requireCityForMap?: boolean;
  /** 地图高度，默认 '400px' */
  mapHeight?: string;
  /** 省市区表单项标签，默认 "省/市/区" */
  cityLabel?: string;
  /** 详细地址输入框占位符 */
  addressPlaceholder?: string;
  /** 详细地址表单项标签，默认 "详细地址" */
  addressLabel?: string;
  /** 地图区域标签，默认 "位置标记" */
  mapLabel?: string;
  /** 地图下方说明或提示（如 * 点击地图选点...） */
  hint?: React.ReactNode;
  /** 省市区是否必填（仅影响 CityPicker 的 required/showClear） */
  cityRequired?: boolean;
  /** 自定义类名 */
  className?: string;
}

const defaultHint = (
  <>* 点击地图选点或拖动标记调整位置，可通过「重新定位」获取当前位置</>
);

/**
 * 地图选点复合组件
 * 整合省市区选择、详细地址输入、天地图选点，适用于教练位置、设施点位等场景。
 * 通过 showCityPicker / showAddressInput / showRelocateButton 控制展示，便于不同页面复用。
 */
const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  value,
  onChange,
  showCityPicker = true,
  showAddressInput = true,
  showRelocateButton = true,
  onRelocate,
  requireCityForMap = true,
  mapHeight = '400px',
  cityLabel = '省/市/区',
  addressPlaceholder = '街道、门牌号等详细信息',
  addressLabel = '详细地址',
  mapLabel = '位置标记',
  hint = defaultHint,
  cityRequired = false,
  className = '',
}) => {
  const province = value.province ?? '';
  const city = value.city ?? '';
  const county = value.county ?? '';
  const address = value.address ?? '';
  const latitude = value.latitude ?? null;
  const longitude = value.longitude ?? null;

  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const update = (patch: Partial<MapLocationValue>) => {
    onChange({ ...value, ...patch });
  };

  /** 逆地理回调：用最新 value 合并 patch。省/市/区 仅当 patch 中为非空时才覆盖，否则保留当前值，避免空串覆盖初始值。 */
  const updateFromReverseGeocode = (patch: Partial<MapLocationValue>) => {
    const cur = valueRef.current;
    const next: MapLocationValue = {
      ...cur,
      address: patch.address ?? cur.address ?? '',
      latitude: patch.latitude !== undefined ? patch.latitude : cur.latitude,
      longitude: patch.longitude !== undefined ? patch.longitude : cur.longitude,
    };
    const setIfNonEmpty = (key: 'province' | 'city' | 'county') => {
      const v = patch[key];
      if (v != null && String(v).trim() !== '') next[key] = String(v).trim();
      else if (cur[key] != null) next[key] = cur[key];
    };
    setIfNonEmpty('province');
    setIfNonEmpty('city');
    setIfNonEmpty('county');
    // 直辖市时接口常返回 city 为空，用 province 补全
    const municipalities = ['北京', '天津', '上海', '重庆'];
    if (next.province && !next.city && municipalities.some(m => next.province === m || next.province === m + '市')) {
      next.city = next.province;
    }
    onChange(next);
  };

  /** 省-市-区 拼接串，供 CityPicker 展示用；任一有值即显示地图 */
  const cityDisplay = [province, city, county].filter(Boolean).join('-');
  const hasCitySelection = !!province || !!city || !!county;
  const canShowMap = requireCityForMap ? hasCitySelection : true;

  return (
    <div className={`space-y-4 ${className}`}>
      {showCityPicker && (
        <div>
          <label className="block text-sm font-medium text-surface-900 mb-2">
            {cityLabel}
            {cityRequired && ' *'}
          </label>
          <CityPicker
            value={cityDisplay}
            onChange={(combined) => {
              const parts = (combined || '').split('-').map((s) => s.trim());
              update({
                province: parts[0] ?? '',
                city: parts[1] ?? '',
                county: parts[2] ?? '',
                address: '',
              });
            }}
            required={cityRequired}
          />
        </div>
      )}

      {showAddressInput && (
        <div>
          <label className="block text-sm font-medium text-surface-900 mb-2">{addressLabel}</label>
          <InputText
            value={address}
            onChange={(e) => update({ address: e.target.value ?? '' })}
            placeholder={addressPlaceholder}
            className="w-full"
          />
        </div>
      )}

      {canShowMap && (
        <div>
          <label className="block text-sm font-medium text-surface-900 mb-2">{mapLabel}</label>
          <TianDiTuMapPicker
            province={province}
            city={city}
            county={county}
            address={address}
            latitude={latitude ?? undefined}
            longitude={longitude ?? undefined}
            onLocationChange={(loc) => update({ latitude: loc.latitude, longitude: loc.longitude })}
            onReverseGeocode={(result) => updateFromReverseGeocode({
              province: result.province ?? '',
              city: result.city ?? '',
              county: result.county ?? '',
              address: result.address ?? '',
              latitude: result.latitude,
              longitude: result.longitude,
            })}
            onAddressChange={(addr) => update({ address: addr ?? '' })}
            onCityChange={(combined) => {
              const parts = (combined || '').split('-').map((s) => s.trim());
              update({ province: parts[0] ?? '', city: parts[1] ?? '', county: parts[2] ?? '' });
            }}
            onRelocate={showRelocateButton ? onRelocate : undefined}
            height={mapHeight}
          />
          {hint != null && <p className="text-xs text-surface-500 mt-2">{hint}</p>}
        </div>
      )}
    </div>
  );
};

export default MapLocationPicker;
