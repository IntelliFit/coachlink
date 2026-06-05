import React, { useState } from 'react'
import { Button, Image, Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  getHuifuRegionCities,
  huifuBankOptions,
  huifuRegionOptions,
} from '@/config/huifuAccountOptions'
import { coachService } from '@/services/coach/coachService'
import './index.scss'

type FormState = {
  name: string
  certNo: string
  mobileNo: string
  certValidityType: '1' | '0'
  certBeginDate: string
  certEndDate: string
  idCardFront: string
  idCardBack: string
  idCardFrontPath: string
  idCardBackPath: string
  cardNo: string
  cardName: string
  bankCode: string
  branchCode: string
  branchName: string
  provId: string
  areaId: string
}

const initialForm: FormState = {
  name: '',
  certNo: '',
  mobileNo: '',
  certValidityType: '1',
  certBeginDate: '',
  certEndDate: '',
  idCardFront: '',
  idCardBack: '',
  idCardFrontPath: '',
  idCardBackPath: '',
  cardNo: '',
  cardName: '',
  bankCode: '',
  branchCode: '',
  branchName: '',
  provId: '',
  areaId: '',
}

function normalizeDate(value: string) {
  return value.replace(/[^\d]/g, '').slice(0, 8)
}

async function fileToBase64(filePath: string) {
  const fs = Taro.getFileSystemManager()
  return new Promise<string>((resolve, reject) => {
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(String(res.data || '')),
      fail: reject,
    })
  })
}

function CoachWalletMerchant() {
  const [step, setStep] = useState<0 | 1>(0)
  const [form, setForm] = useState<FormState>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const selectedBankIndex = huifuBankOptions.findIndex(option => option.code === form.bankCode)
  const cityOptions = getHuifuRegionCities(form.provId)
  const selectedProvinceIndex = huifuRegionOptions.findIndex(option => option.code === form.provId)
  const selectedCityIndex = cityOptions.findIndex(option => option.code === form.areaId)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function chooseIdCard(side: 'front' | 'back') {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      const path = res.tempFilePaths?.[0]
      if (!path) return
      const base64 = await fileToBase64(path)
      if (side === 'front') {
        update('idCardFrontPath', path)
        update('idCardFront', base64)
      } else {
        update('idCardBackPath', path)
        update('idCardBack', base64)
      }
    } catch (error) {
      console.error('[wallet/merchant] choose image failed:', error)
      Taro.showToast({ title: '读取证件照片失败', icon: 'none' })
    }
  }

  function canNext() {
    if (!form.name.trim() || !form.certNo.trim() || !form.mobileNo.trim()) return false
    if (!form.certBeginDate.trim()) return false
    if (form.certValidityType === '0' && !form.certEndDate.trim()) return false
    return Boolean(form.idCardFront && form.idCardBack)
  }

  function canSubmit() {
    return Boolean(
      form.cardNo.trim() &&
      form.cardName.trim() &&
      form.bankCode.trim() &&
      form.branchCode.trim() &&
      form.branchName.trim() &&
      form.provId.trim() &&
      form.areaId.trim()
    )
  }

  async function submit() {
    if (!canSubmit()) {
      Taro.showToast({ title: '请补充银行卡和开户行信息', icon: 'none' })
      return
    }
    try {
      setSubmitting(true)
      const res = await coachService.openHuifuAccount({
        name: form.name.trim(),
        certNo: form.certNo.trim(),
        mobileNo: form.mobileNo.trim(),
        certValidityType: form.certValidityType,
        certBeginDate: normalizeDate(form.certBeginDate),
        certEndDate: form.certValidityType === '1' ? undefined : normalizeDate(form.certEndDate),
        idCardFront: form.idCardFront,
        idCardBack: form.idCardBack,
        cardNo: form.cardNo.trim(),
        cardName: form.cardName.trim(),
        bankCode: form.bankCode.trim(),
        branchCode: form.branchCode.trim(),
        branchName: form.branchName.trim(),
        provId: form.provId.trim(),
        areaId: form.areaId.trim(),
      })
      if (res.success) {
        Taro.showModal({
          title: '提交成功',
          content: res.message || '收款账户资料已提交',
          showCancel: false,
          success: () => Taro.navigateBack(),
        })
      } else {
        Taro.showToast({ title: res.message || '提交失败', icon: 'none' })
      }
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="merchant-page">
      <ScrollView scrollY className="merchant-scroll">
        <View className="notice-card">
          <Text className="notice-title">汇付收款账户</Text>
          <Text className="notice-desc">用于接收教练订阅和教练内容分账，并提现到本人银行卡。请填写与身份证、银行卡一致的信息。</Text>
        </View>

        <View className="step-tabs">
          <Text className={`step-tab ${step === 0 ? 'active' : ''}`}>1 身份信息</Text>
          <Text className={`step-tab ${step === 1 ? 'active' : ''}`}>2 提现银行卡</Text>
        </View>

        {step === 0 ? (
          <View className="form-card">
            <Text className="section-title">身份信息</Text>
            <View className="field">
              <Text className="label">姓名 *</Text>
              <Input className="input" value={form.name} placeholder="与身份证一致" onInput={e => update('name', e.detail.value)} />
            </View>
            <View className="field">
              <Text className="label">身份证号 *</Text>
              <Input className="input" value={form.certNo} maxlength={18} placeholder="请输入身份证号" onInput={e => update('certNo', e.detail.value)} />
            </View>
            <View className="field">
              <Text className="label">手机号 *</Text>
              <Input className="input" type="number" value={form.mobileNo} maxlength={11} placeholder="银行预留或本人手机号" onInput={e => update('mobileNo', e.detail.value)} />
            </View>
            <View className="field">
              <Text className="label">证件有效期类型 *</Text>
              <View className="segmented">
                <Text className={`segment ${form.certValidityType === '1' ? 'active' : ''}`} onClick={() => update('certValidityType', '1')}>长期有效</Text>
                <Text className={`segment ${form.certValidityType === '0' ? 'active' : ''}`} onClick={() => update('certValidityType', '0')}>非长期</Text>
              </View>
            </View>
            <View className="field">
              <Text className="label">有效期开始日期 *</Text>
              <Input className="input" type="number" value={form.certBeginDate} maxlength={8} placeholder="例如 20200101" onInput={e => update('certBeginDate', normalizeDate(e.detail.value))} />
            </View>
            {form.certValidityType === '0' && (
              <View className="field">
                <Text className="label">有效期截止日期 *</Text>
                <Input className="input" type="number" value={form.certEndDate} maxlength={8} placeholder="例如 20400101" onInput={e => update('certEndDate', normalizeDate(e.detail.value))} />
              </View>
            )}

            <View className="photo-grid">
              <View className="photo-uploader" onClick={() => chooseIdCard('front')}>
                {form.idCardFrontPath ? <Image src={form.idCardFrontPath} className="photo-preview" mode="aspectFill" /> : <Text className="photo-placeholder">上传人像面</Text>}
              </View>
              <View className="photo-uploader" onClick={() => chooseIdCard('back')}>
                {form.idCardBackPath ? <Image src={form.idCardBackPath} className="photo-preview" mode="aspectFill" /> : <Text className="photo-placeholder">上传国徽面</Text>}
              </View>
            </View>

            <Button className="submit-btn" disabled={!canNext()} onClick={() => setStep(1)}>下一步</Button>
          </View>
        ) : (
          <View className="form-card">
            <Text className="section-title">提现银行卡</Text>
            <Text className="section-hint">个人教练固定绑定本人对私银行卡。请选择银行卡所属银行，系统会自动带出银行编码；支行联行号是具体开户支行的清算编号。</Text>
            <View className="field">
              <Text className="label">银行卡户名 *</Text>
              <Input className="input" value={form.cardName} placeholder="通常与身份证姓名一致" onInput={e => update('cardName', e.detail.value)} />
            </View>
            <View className="field">
              <Text className="label">银行卡号 *</Text>
              <Input className="input" type="number" value={form.cardNo} placeholder="请输入银行卡号" onInput={e => update('cardNo', e.detail.value)} />
            </View>
            <View className="field">
              <Text className="label">开户银行 *</Text>
              <Picker
                mode="selector"
                range={huifuBankOptions}
                rangeKey="name"
                value={selectedBankIndex >= 0 ? selectedBankIndex : 0}
                onChange={e => {
                  const option = huifuBankOptions[Number(e.detail.value)]
                  if (option) update('bankCode', option.code)
                }}
              >
                <View className={`picker-field ${selectedBankIndex >= 0 ? '' : 'placeholder'}`}>
                  {selectedBankIndex >= 0 ? huifuBankOptions[selectedBankIndex].name : '请选择银行卡所属银行'}
                </View>
              </Picker>
              <Text className="field-hint">选择后自动提交开户银行编码；列表没有时请联系平台运营补充，不要随便选择相近银行。</Text>
            </View>
            <View className="field">
              <Text className="label">开户银行编码</Text>
              <View className={`code-preview ${form.bankCode ? '' : 'placeholder'}`}>
                {form.bankCode || '选择银行后自动生成'}
              </View>
            </View>
            <View className="field">
              <Text className="label">具体支行联行号 *</Text>
              <Input className="input" type="number" maxlength={12} value={form.branchCode} placeholder="请输入 12 位支行联行号" onInput={e => update('branchCode', e.detail.value.replace(/\D/g, '').slice(0, 12))} />
            </View>
            <View className="field">
              <Text className="label">支行名称 *</Text>
              <Input className="input" value={form.branchName} placeholder="例如 中国农业银行xx支行" onInput={e => update('branchName', e.detail.value)} />
            </View>
            <View className="help-card">
              <Text className="help-title">不知道支行联行号怎么找？</Text>
              <Text className="help-text">优先在银行 App/网银查看开户网点，或拨打银行卡背面的银行客服电话，询问“开户支行名称”和“12 位支行联行号/CNAPS 号”。</Text>
              <Text className="help-text">银行卡所属银行、开户银行选择、支行联行号必须属于同一家银行；不确定时不要用相近银行编码代替。</Text>
            </View>
            <View className="field">
              <Text className="label">开户省份 *</Text>
              <Picker
                mode="selector"
                range={huifuRegionOptions}
                rangeKey="name"
                value={selectedProvinceIndex >= 0 ? selectedProvinceIndex : 0}
                onChange={e => {
                  const option = huifuRegionOptions[Number(e.detail.value)]
                  if (option) setForm(prev => ({ ...prev, provId: option.code, areaId: '' }))
                }}
              >
                <View className={`picker-field ${selectedProvinceIndex >= 0 ? '' : 'placeholder'}`}>
                  {selectedProvinceIndex >= 0 ? huifuRegionOptions[selectedProvinceIndex].name : '请选择开户省份'}
                </View>
              </Picker>
            </View>
            <View className="field">
              <Text className="label">开户城市/区县 *</Text>
              <Picker
                mode="selector"
                range={cityOptions}
                rangeKey="name"
                value={selectedCityIndex >= 0 ? selectedCityIndex : 0}
                disabled={!form.provId}
                onChange={e => {
                  const option = cityOptions[Number(e.detail.value)]
                  if (option) update('areaId', option.code)
                }}
              >
                <View className={`picker-field ${selectedCityIndex >= 0 ? '' : 'placeholder'}`}>
                  {selectedCityIndex >= 0 ? cityOptions[selectedCityIndex].name : (form.provId ? '请选择开户城市/区县' : '请先选择省份')}
                </View>
              </Picker>
            </View>
            <View className="field">
              <Text className="label">地区编码</Text>
              <View className={`code-preview ${form.provId && form.areaId ? '' : 'placeholder'}`}>
                {form.provId && form.areaId ? `${form.provId} / ${form.areaId}` : '选择省份和城市/区县后自动生成'}
              </View>
            </View>
            <View className="action-row">
              <Button className="secondary-btn" onClick={() => setStep(0)}>上一步</Button>
              <Button className="submit-btn inline" loading={submitting} disabled={!canSubmit()} onClick={submit}>提交开通</Button>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

export default CoachWalletMerchant
