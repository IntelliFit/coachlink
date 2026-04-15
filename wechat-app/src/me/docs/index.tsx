import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

/**
 * 文档列表/详情。可通过 query slug 展示单篇（如 ?slug=terms）。
 * 无 slug 时展示文档入口列表。
 */
const DOC_ENTRIES = [
  { title: '免责声明', slug: 'disclaimer', path: '/me/disclaimer/index' },
  { title: '关于我们', slug: 'about', path: '/me/about/index' },
  { title: '联系我们', slug: 'contact', path: '/me/contact/index' }
]

export default function Docs() {
  const [slug, setSlug] = useState<string | null>(null)

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    const s = params.slug as string
    if (s) setSlug(s)
  }, [])

  const openDoc = (path: string) => {
    Taro.navigateTo({ url: path })
  }

  return (
    <View className="docs-page">
      <ScrollView scrollY className="docs-scroll">
        <View className="doc-list">
          <Text className="list-title">文档</Text>
          {DOC_ENTRIES.map((entry) => (
            <View
              key={entry.slug}
              className="doc-item"
              onClick={() => openDoc(entry.path)}
            >
              <Text className="doc-item-title">{entry.title}</Text>
              <Text className="doc-item-arrow">→</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
