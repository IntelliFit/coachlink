import { ScrollView, Text, View } from '@tarojs/components'

export type ChoiceOption<T extends string> = {
  value: T
  label: string
  /** Second line under the label, e.g. the kg range of a form-quality level. */
  hint?: string
}

type ChoiceChipsProps<T extends string> = {
  options: ChoiceOption<T>[]
  value: T | '' | null | undefined
  onChange: (value: T) => void
  /** 'scroll' keeps one row and scrolls sideways; 'grid' wraps into equal columns. */
  layout?: 'scroll' | 'grid'
  columns?: 2 | 3 | 4
}

/** One-tap replacement for a selector Picker when the options are few and short. */
export function ChoiceChips<T extends string>({ options, value, onChange, layout = 'grid', columns = 2 }: ChoiceChipsProps<T>) {
  const chips = options.map((option) => {
    const selected = option.value === value
    return (
      <View
        key={option.value}
        className={`choice-chip ${selected ? 'choice-chip--selected' : ''} ${option.hint ? 'choice-chip--with-hint' : ''}`}
        onClick={() => {
          if (!selected) onChange(option.value)
        }}
      >
        <Text className='choice-chip__label'>{option.label}</Text>
        {option.hint ? <Text className='choice-chip__hint'>{option.hint}</Text> : null}
      </View>
    )
  })

  if (layout === 'scroll') {
    return (
      <ScrollView className='choice-chips-scroll' scrollX enhanced showScrollbar={false}>
        <View className='choice-chips choice-chips--scroll'>{chips}</View>
      </ScrollView>
    )
  }

  return <View className={`choice-chips choice-chips--grid choice-chips--cols-${columns}`}>{chips}</View>
}
