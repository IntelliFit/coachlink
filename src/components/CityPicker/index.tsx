'use client';

import React, { useState, useEffect } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { provinceData, type Province, type City, type District } from './cityData';

interface CityPickerProps {
  value?: string; // 格式：省-市-区，例如："广东省-深圳市-南山区"
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

/**
 * 省市区级联选择组件
 */
const CityPicker: React.FC<CityPickerProps> = ({
  value,
  onChange,
  required = false,
  placeholder = '请选择'
}) => {
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');

  const [cityOptions, setCityOptions] = useState<City[]>([]);
  const [districtOptions, setDistrictOptions] = useState<District[]>([]);

  // 初始化：从 value 解析省/市/区（支持仅省、省-市、省-市-区 三种格式）
  useEffect(() => {
    if (value) {
      const parts = value.split('-').map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 1) {
        const [p, c, d] = parts;
        setSelectedProvince(p ?? '');
        setSelectedCity(c ?? '');
        setSelectedDistrict(d ?? '');

        const provinceData_item = provinceData.find(pr => pr.value === (p ?? ''));
        if (provinceData_item) {
          setCityOptions(provinceData_item.cities);
          const cityData_item = (c && provinceData_item.cities) 
            ? provinceData_item.cities.find(ci => ci.value === c) 
            : undefined;
          if (cityData_item) {
            setDistrictOptions(cityData_item.districts);
          } else {
            setDistrictOptions([]);
          }
        } else {
          setCityOptions([]);
          setDistrictOptions([]);
        }
      }
    }
  }, [value]);

  // 省份变化
  const handleProvinceChange = (provinceValue: string) => {
    setSelectedProvince(provinceValue);
    setSelectedCity('');
    setSelectedDistrict('');
    setDistrictOptions([]);

    const province = provinceData.find(p => p.value === provinceValue);
    if (province) {
      setCityOptions(province.cities);
    } else {
      setCityOptions([]);
    }

    // 有省份时传出省份值，供地图定位；未选择则传空
    onChange(provinceValue || '');
  };

  // 城市变化
  const handleCityChange = (cityValue: string) => {
    setSelectedCity(cityValue);
    setSelectedDistrict('');

    const province = provinceData.find(p => p.value === selectedProvince);
    if (province) {
      const city = province.cities.find(c => c.value === cityValue);
      if (city) {
        setDistrictOptions(city.districts);
      } else {
        setDistrictOptions([]);
      }
    }

    // 传出"省-市"或仅省份，供地图定位
    if (cityValue && selectedProvince) {
      onChange(`${selectedProvince}-${cityValue}`);
    } else {
      onChange(selectedProvince || '');
    }
  };

  // 区县变化
  const handleDistrictChange = (districtValue: string) => {
    setSelectedDistrict(districtValue);

    if (districtValue && selectedProvince && selectedCity) {
      onChange(`${selectedProvince}-${selectedCity}-${districtValue}`);
    } else if (selectedProvince && selectedCity) {
      onChange(`${selectedProvince}-${selectedCity}`);
    } else {
      onChange(selectedProvince || '');
    }
  };

    return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* 省份选择 */}
      <div className="flex-1 min-w-0">
        <Dropdown
          value={selectedProvince}
          options={provinceData}
          onChange={(e) => handleProvinceChange(e.value)}
          optionLabel="label"
          optionValue="value"
          placeholder="省份"
          className="w-full"
          showClear={!required}
        />
      </div>

      {/* 城市选择 */}
      <div className="flex-1 min-w-0">
        <Dropdown
          value={selectedCity}
          options={cityOptions}
          onChange={(e) => handleCityChange(e.value)}
          optionLabel="label"
          optionValue="value"
          placeholder="城市"
          className="w-full"
          disabled={!selectedProvince}
          showClear={!required}
        />
      </div>

      {/* 区县选择 */}
      <div className="flex-1 min-w-0">
        <Dropdown
          value={selectedDistrict}
          options={districtOptions}
          onChange={(e) => handleDistrictChange(e.value)}
          optionLabel="label"
          optionValue="value"
          placeholder="区县"
          className="w-full"
          disabled={!selectedCity}
          showClear={!required}
        />
      </div>
    </div>
  );
};

export default CityPicker;
