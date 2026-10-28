import React from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import { RPE_QUICK_PICKS } from '@coachlink/core/src/trainingViewMode'
import { weightUnitLabel, type SetWeightUnit } from '@coachlink/core/src/weightUnit'

export type SetEditorPanel = 'note' | 'video' | null

export interface SetEditorProps {
  /** large = 卡片模式：数字更大、加减按钮放在数字下方，底色随卡片 */
  size: 'regular' | 'large'
  setNumber: number
  editing: boolean
  timed: boolean
  bodyweight: boolean
  weightLabel: string
  weightUnit: SetWeightUnit
  weightInput: string
  weightPlaceholder: string
  reps: number | null
  repsPlaceholder: string
  rpe: number | null
  markAsPR: boolean
  notes: string
  panel: SetEditorPanel
  hasVideo: boolean
  uploadingVideo: boolean
  completing: boolean
  plannedHint: string
  /** 「改为自重 / + 加负重」；计时组没有这个切换 */
  loadModeLabel: string | null
  showCompleteButton: boolean
  onUnitChange: (unit: SetWeightUnit) => void
  onWeightInput: (raw: string) => void
  onWeightStep: (direction: 1 | -1) => void
  onRepsInput: (raw: string) => void
  onRepsStep: (direction: 1 | -1) => void
  onRpePick: (value: number) => void
  onTogglePR: () => void
  onTogglePanel: (panel: Exclude<SetEditorPanel, null>) => void
  onNotesInput: (value: string) => void
  onChooseVideo: () => void
  onPasteVideoLink: () => void
  onPreviewVideo: () => void
  onToggleLoadMode: () => void
  onComplete: () => void
  onCancelEdit?: () => void
}

function Stepper({ large, label, extra, value, unit, inputType, placeholder, onInput, onStep }: {
  large: boolean
  label: string
  extra?: React.ReactNode
  value: string
  unit?: string
  inputType: 'digit' | 'number'
  placeholder: string
  onInput: (raw: string) => void
  onStep: (direction: 1 | -1) => void
}) {
  const decrease = (
    <View className="txv3-stepper__btn" onClick={(e) => { e.stopPropagation(); onStep(-1) }}>
      <Text className="txv3-stepper__sign">−</Text>
    </View>
  )
  const increase = (
    <View className="txv3-stepper__btn" onClick={(e) => { e.stopPropagation(); onStep(1) }}>
      <Text className="txv3-stepper__sign">+</Text>
    </View>
  )
  const field = (
    <View className="txv3-stepper__field">
      <Input
        type={inputType}
        className="txv3-stepper__input"
        value={value}
        placeholder={placeholder}
        placeholderClass="txv3-stepper__placeholder"
        onInput={(e) => onInput(e.detail.value)}
      />
      {unit ? <Text className="txv3-stepper__unit">{unit}</Text> : null}
    </View>
  )
  return (
    <View className="txv3-stepper">
      <View className="txv3-stepper__head">
        <Text className="txv3-stepper__label">{label}</Text>
        {extra}
      </View>
      {large ? (
        <>
          {field}
          <View className="txv3-stepper__pair">{decrease}{increase}</View>
        </>
      ) : (
        <View className="txv3-stepper__row">{decrease}{field}{increase}</View>
      )}
    </View>
  )
}

export default function SetEditor(props: SetEditorProps) {
  const large = props.size === 'large'
  const showWeight = !props.timed && !props.bodyweight
  const unitToggle = (
    <View className="txv3-unit">
      {(['kg', 'lbs'] as SetWeightUnit[]).map((unit) => (
        <Text
          key={unit}
          className={`txv3-unit__option ${props.weightUnit === unit ? 'is-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); props.onUnitChange(unit) }}
        >
          {weightUnitLabel(unit)}
        </Text>
      ))}
    </View>
  )

  return (
    <View className={`txv3-editor ${large ? 'txv3-editor--large' : ''}`} onClick={(e) => e.stopPropagation()}>
      <View className="txv3-editor__head">
        <Text className="txv3-editor__title">{props.editing ? `修改第 ${props.setNumber} 组` : `第 ${props.setNumber} 组`}</Text>
        {props.plannedHint ? <Text className="txv3-editor__hint cl-num">{props.plannedHint}</Text> : null}
        {props.loadModeLabel ? (
          <Text className="txv3-editor__link" onClick={props.onToggleLoadMode}>{props.loadModeLabel}</Text>
        ) : null}
      </View>

      <View className={`txv3-steppers ${showWeight ? '' : 'is-single'}`}>
        {showWeight ? (
          <Stepper
            large={large}
            label={props.weightLabel}
            extra={unitToggle}
            value={props.weightInput}
            inputType="digit"
            placeholder={props.weightPlaceholder}
            onInput={props.onWeightInput}
            onStep={props.onWeightStep}
          />
        ) : null}
        <Stepper
          large={large}
          label={props.timed ? '保持时长' : props.bodyweight ? '次数 · 自重' : '次数'}
          value={props.reps !== null && props.reps !== undefined ? String(props.reps) : ''}
          unit={props.timed ? '秒' : undefined}
          inputType="number"
          placeholder={props.repsPlaceholder}
          onInput={props.onRepsInput}
          onStep={props.onRepsStep}
        />
      </View>

      <View className="txv3-rpe">
        <Text className="txv3-rpe__label">RPE</Text>
        {RPE_QUICK_PICKS.map((value) => (
          <Text
            key={value}
            className={`txv3-rpe__pill cl-num ${props.rpe === value ? 'is-active' : ''}`}
            onClick={() => props.onRpePick(value)}
          >
            {value}
          </Text>
        ))}
      </View>

      <View className="txv3-tools">
        <View className={`txv3-tool ${props.markAsPR ? 'is-on' : ''}`} onClick={props.onTogglePR}>
          <Text className="txv3-tool__text">{props.markAsPR ? '✓ 进步组' : '进步组'}</Text>
        </View>
        <View className={`txv3-tool ${props.panel === 'note' || props.notes ? 'is-on' : ''}`} onClick={() => props.onTogglePanel('note')}>
          <Text className="txv3-tool__text">{props.notes ? '已写备注' : '备注'}</Text>
        </View>
        <View className={`txv3-tool ${props.panel === 'video' || props.hasVideo ? 'is-on' : ''}`} onClick={() => props.onTogglePanel('video')}>
          <Text className="txv3-tool__text">{props.hasVideo ? '已加视频' : '视频'}</Text>
        </View>
      </View>

      {props.panel === 'note' ? (
        <Input
          className="txv3-note"
          value={props.notes}
          placeholder="手感、节奏或动作问题"
          onInput={(e) => props.onNotesInput(e.detail.value)}
        />
      ) : null}
      {props.panel === 'video' ? (
        <View className="txv3-video">
          <Button className="txv3-video__btn" onClick={props.onChooseVideo} loading={props.uploadingVideo}>
            {props.hasVideo ? '换视频' : '选视频'}
          </Button>
          <Button className="txv3-video__btn" onClick={props.onPasteVideoLink}>贴链接</Button>
          {props.hasVideo ? <Button className="txv3-video__btn" onClick={props.onPreviewVideo}>预览</Button> : null}
        </View>
      ) : null}

      {props.showCompleteButton ? (
        <Button className="txv3-primary" onClick={props.onComplete} loading={props.completing}>
          {props.editing ? '保存修改' : `完成第 ${props.setNumber} 组`}
        </Button>
      ) : null}
      {props.editing && props.onCancelEdit ? (
        <Text className="txv3-editor__cancel" onClick={props.onCancelEdit}>取消修改</Text>
      ) : null}
    </View>
  )
}
