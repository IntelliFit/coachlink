import React, { useState } from 'react'
import { Button, Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
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
            <Text className="section-hint">个人教练固定绑定本人对私银行卡。银行编码、支行联行号、省市编码请按汇付/银行编码表填写。</Text>
            <View className="field">
              <Text className="label">银行卡户名 *</Text>
              <Input className="input" value={form.cardName} placeholder="通常与身份证姓名一致" onInput={e => update('cardName', e.detail.value)} />
            </View>
            <View className="field">
              <Text className="label">银行卡号 *</Text>
              <Input className="input" type="number" value={form.cardNo} placeholder="请输入银行卡号" onInput={e => update('cardNo', e.detail.value)} />
            </View>
            <View className="field">
              <Text className="label">开户银行编码 *</Text>
              <Input className="input" value={form.bankCode} placeholder="例如 01030000" onInput={e => update('bankCode', e.detail.value)} />
            </View>
            <View className="field">
              <Text className="label">支行联行号 *</Text>
              <Input className="input" value={form.branchCode} placeholder="请输入支行联行号" onInput={e => update('branchCode', e.detail.value)} />
            </View>
            <View className="field">
              <Text className="label">支行名称 *</Text>
              <Input className="input" value={form.branchName} placeholder="例如 中国农业银行xx支行" onInput={e => update('branchName', e.detail.value)} />
            </View>
            <View className="two-cols">
              <View className="field half">
                <Text className="label">省编码 *</Text>
                <Input className="input" value={form.provId} placeholder="例如 310000" onInput={e => update('provId', e.detail.value)} />
              </View>
              <View className="field half">
                <Text className="label">市/区编码 *</Text>
                <Input className="input" value={form.areaId} placeholder="例如 310100" onInput={e => update('areaId', e.detail.value)} />
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
