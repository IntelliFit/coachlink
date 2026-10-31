import { describe, expect, it } from 'vitest'
import { BOJI_MAX_UPLOAD_BYTES, analyzeBojiQuery, bojiContentType, bojiDetailSummary, bojiUploadError, withTimeout } from '../../apps/mobile/src/screens/toolbox/bojiModel'

const SCORE_ID = '123e4567-e89b-42d3-a456-426614174000'

describe('boji detector request (same as the mini-program)', () => {
  it('only sends a valid challenge id and the female profile flag', () => {
    expect(analyzeBojiQuery(null, 'male')).toBe('')
    expect(analyzeBojiQuery(SCORE_ID, 'male')).toBe(`?challenge=${SCORE_ID}`)
    expect(analyzeBojiQuery('not-a-uuid&x=1', 'male')).toBe('')
    expect(analyzeBojiQuery(SCORE_ID, 'female')).toBe(`?challenge=${SCORE_ID}&sex=female`)
    expect(analyzeBojiQuery(undefined, 'female')).toBe('?sex=female')
  })

  it('rejects oversized photos before uploading', () => {
    expect(bojiUploadError(BOJI_MAX_UPLOAD_BYTES)).toBe('')
    expect(bojiUploadError(BOJI_MAX_UPLOAD_BYTES + 1)).toContain('照片太大')
    expect(bojiUploadError(undefined)).toBe('')
  })

  it('only labels uploads with types the server accepts', () => {
    expect(bojiContentType('image/png')).toBe('image/png')
    expect(bojiContentType('IMAGE/WEBP')).toBe('image/webp')
    expect(bojiContentType('image/heic')).toBe('image/jpeg')
    expect(bojiContentType(null)).toBe('image/jpeg')
  })

  it('gives up on an upload that never returns', async () => {
    await expect(withTimeout(new Promise(() => undefined), 5, '超时')).rejects.toThrow('超时')
    await expect(withTimeout(Promise.resolve(1), 1000, '超时')).resolves.toBe(1)
    await expect(withTimeout(Promise.reject(new Error('失败')), 1000, '超时')).rejects.toThrow('失败')
  })

  it('summarises the raw measurements per profile', () => {
    const base = { waistHipRatio: 0.72, shoulderWaistRatio: 1.4, upperArmRatio: 0.31, silhouetteIou: 0.86 } as any
    expect(bojiDetailSummary({ ...base, sex: 'male' })).toBe('肩腰比 1.40 · 上臂宽/长 0.31 · 轮廓重合 86%')
    expect(bojiDetailSummary({ ...base, sex: 'female' })).toBe('腰臀比 0.72 · 肩腰比 1.40 · 轮廓重合 86%')
    expect(bojiDetailSummary({ sex: 'male', waistHipRatio: null, shoulderWaistRatio: null, upperArmRatio: null, silhouetteIou: null } as any)).toBe('')
  })
})
