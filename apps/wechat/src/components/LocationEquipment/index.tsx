import { Button, Text, View } from '@tarojs/components'
import { LOCATION_EQUIPMENT_OPTIONS, locationEquipmentLabel, resolveLocationEquipment, type LocationEquipmentInput, type LocationEquipmentType } from '@coachlink/core'
import './index.scss'

export function EquipmentSelector({ value, onChange, filter = false }: {
  value: LocationEquipmentType[]
  onChange: (value: LocationEquipmentType[]) => void
  filter?: boolean
}) {
  return <View className='equipment-selector'>
    <View className='equipment-options'>
      {filter && <Button className={`equipment-option equipment-all${!value.length ? ' selected' : ''}`} onClick={() => onChange([])}>全部器材</Button>}
      {LOCATION_EQUIPMENT_OPTIONS.map(option => <Button key={option.code} className={`equipment-option equipment-${option.code}${value.includes(option.code) ? ' selected' : ''}`} onClick={() => onChange(value.includes(option.code) ? value.filter(type => type !== option.code) : [...value, option.code])}>{option.label}</Button>)}
    </View>
    {filter && value.length > 1 && <Text className='equipment-hint'>同时包含所选器材</Text>}
  </View>
}

export function EquipmentTags({ location }: { location: LocationEquipmentInput }) {
  const equipment = resolveLocationEquipment(location)
  return <View className='equipment-tags'>
    {equipment.equipment_types.length ? equipment.equipment_types.map(type => <Text key={type} className='equipment-tag'>{locationEquipmentLabel(type)}</Text>) : <Text className='equipment-hint'>器材待补充</Text>}
    {equipment.equipment_source === 'description' && <Text className='equipment-hint'>据描述</Text>}
  </View>
}
