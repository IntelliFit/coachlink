'use client';

import React, { useState } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Rating } from 'primereact/rating';
import { Tag } from 'primereact/tag';
import { useRouter } from 'next/navigation';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Search, MapPin, Award, Heart } from 'lucide-react';

// 教练数据示例
const coachesData = [
    {
        id: 1,
        name: '张教练',
        specialty: '力量训练',
        rating: 4.8,
        reviewCount: 128,
        experience: '5年经验',
        location: '北京市',
        price: '¥150/课时',
        image: '/images/coach1.jpg',
        tags: ['增肌', '减脂', '康复训练'],
        favorite: false
    },
    {
        id: 2,
        name: '李教练',
        specialty: '瑜伽普拉提',
        rating: 4.9,
        reviewCount: 96,
        experience: '8年经验',
        location: '上海市',
        price: '¥200/课时',
        image: '/images/coach2.jpg',
        tags: ['柔韧性', '放松', '产后修复'],
        favorite: true
    },
    {
        id: 3,
        name: '王教练',
        specialty: '功能性训练',
        rating: 4.7,
        reviewCount: 215,
        experience: '6年经验',
        location: '广州市',
        price: '¥180/课时',
        image: '/images/coach3.jpg',
        tags: ['体态矫正', '核心训练', '敏捷性'],
        favorite: false
    },
    {
        id: 4,
        name: '赵教练',
        specialty: '跑步专项',
        rating: 4.6,
        reviewCount: 87,
        experience: '4年经验',
        location: '深圳市',
        price: '¥120/课时',
        image: '/images/coach4.jpg',
        tags: ['马拉松', '燃脂跑', '跑步技巧'],
        favorite: false
    },
    {
        id: 5,
        name: '陈教练',
        specialty: '拳击格斗',
        rating: 4.9,
        reviewCount: 142,
        experience: '10年经验',
        location: '成都市',
        price: '¥220/课时',
        image: '/images/coach5.jpg',
        tags: ['搏击', '防身术', '心肺功能'],
        favorite: false
    },
    {
        id: 6,
        name: '刘教练',
        specialty: '游泳指导',
        rating: 4.8,
        reviewCount: 76,
        experience: '7年经验',
        location: '杭州市',
        price: '¥160/课时',
        image: '/images/coach6.jpg',
        tags: ['自由泳', '蛙泳', '体姿纠正'],
        favorite: true
    }
];

const specialties = [
    { label: '全部', value: null },
    { label: '力量训练', value: '力量训练' },
    { label: '瑜伽普拉提', value: '瑜伽普拉提' },
    { label: '功能性训练', value: '功能性训练' },
    { label: '跑步专项', value: '跑步专项' },
    { label: '拳击格斗', value: '拳击格斗' },
    { label: '游泳指导', value: '游泳指导' }
];

const locations = [
    { label: '全部地区', value: null },
    { label: '北京', value: '北京市' },
    { label: '上海', value: '上海市' },
    { label: '广州', value: '广州市' },
    { label: '深圳', value: '深圳市' },
    { label: '成都', value: '成都市' },
    { label: '杭州', value: '杭州市' }
];

export default function FindCoachesPage() {
    const router = useRouter();
    const [coaches, setCoaches] = useState(coachesData);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSpecialty, setSelectedSpecialty] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [favoritesOnly, setFavoritesOnly] = useState(false);

    const toggleFavorite = (id: number) => {
        setCoaches(coaches.map(coach => 
            coach.id === id ? { ...coach, favorite: !coach.favorite } : coach
        ));
    };

    const filteredCoaches = coaches.filter(coach => {
        const matchesSearch = coach.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             coach.specialty.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSpecialty = selectedSpecialty ? coach.specialty === selectedSpecialty : true;
        const matchesLocation = selectedLocation ? coach.location.includes(selectedLocation) : true;
        const matchesFavorites = favoritesOnly ? coach.favorite : true;
        
        return matchesSearch && matchesSpecialty && matchesLocation && matchesFavorites;
    });

    const navigateTo = (path: string) => {
        router.push(path);
    };

    return (
        <div>
            {/* 搜索和筛选区 */}
            <Card className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                        <IconField iconPosition="left">
                            <InputIcon className="pi pi-search"> </InputIcon>
                            <InputText 
                                placeholder="搜索教练姓名或专长..." 
                                className="w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </IconField>
                    </div>
                    
                    <Dropdown
                        value={selectedSpecialty}
                        options={specialties}
                        onChange={(e) => setSelectedSpecialty(e.value)}
                        placeholder="选择专长"
                        className="w-full"
                    />
                    
                    <Dropdown
                        value={selectedLocation}
                        options={locations}
                        onChange={(e) => setSelectedLocation(e.value)}
                        placeholder="选择地区"
                        className="w-full"
                    />
                </div>
                
                <div className="flex items-center mt-4">
                    <Button 
                        icon={favoritesOnly ? "pi pi-heart-fill" : "pi pi-heart"} 
                        label="只看收藏"
                        className={`p-button-outlined ${favoritesOnly ? 'p-button-danger' : ''}`}
                        onClick={() => setFavoritesOnly(!favoritesOnly)}
                    />
                    <Button 
                        label="重置筛选"
                        className="p-button-text ml-2"
                        onClick={() => {
                            setSearchTerm('');
                            setSelectedSpecialty(null);
                            setSelectedLocation(null);
                            setFavoritesOnly(false);
                        }}
                    />
                </div>
            </Card>

            {/* 教练列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCoaches.map((coach) => (
                    <Card key={coach.id} className="shadow-md hover:shadow-lg transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center">
                                    <h3 className="text-xl font-bold mr-2">{coach.name}</h3>
                                    <Tag value={coach.experience} severity="success" />
                                </div>
                                <p className="text-600 mt-1">{coach.specialty}</p>
                            </div>
                            <Button 
                                icon={coach.favorite ? "pi pi-heart-fill" : "pi pi-heart"} 
                                className={`p-button-rounded p-button-text ${coach.favorite ? 'text-red-500' : 'text-500'}`}
                                onClick={() => toggleFavorite(coach.id)}
                            />
                        </div>

                        <div className="flex items-center text-600 mb-2">
                            <MapPin size={16} className="mr-1" />
                            <span>{coach.location}</span>
                        </div>

                        <div className="flex items-center mb-4">
                            <Rating value={coach.rating} readOnly cancel={false} />
                            <span className="ml-2 text-600">({coach.reviewCount})</span>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {coach.tags.map((tag, index) => (
                                <Tag key={index} value={tag} severity="info" />
                            ))}
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-xl font-bold text-900">{coach.price}</span>
                            <div className="flex gap-2">
                                <Button 
                                    icon="pi pi-eye" 
                                    label="查看详情"
                                    className="p-button-outlined p-button-sm"
                                    onClick={() => navigateTo(`/coach/${coach.id}`)}
                                />
                                <Button 
                                    label="立即预约"
                                    className="p-button-sm"
                                    onClick={() => navigateTo(`/booking?coach=${coach.id}`)}
                                />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {filteredCoaches.length === 0 && (
                <div className="text-center py-12">
                    <i className="pi pi-search text-5xl text-400 mb-4"></i>
                    <h3 className="text-xl font-bold mb-2">未找到符合条件的教练</h3>
                    <p className="text-600 mb-4">请尝试调整筛选条件</p>
                    <Button 
                        label="清除所有筛选" 
                        onClick={() => {
                            setSearchTerm('');
                            setSelectedSpecialty(null);
                            setSelectedLocation(null);
                            setFavoritesOnly(false);
                        }}
                    />
                </div>
            )}
        </div>
    );
}