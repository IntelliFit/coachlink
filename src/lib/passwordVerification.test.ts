import { describe, expect, it } from 'vitest'
import { hashPassword, isPasswordHash, verifyPassword } from '../app/api/auth/[...nextauth]/verify'
import { toPublicApiMessage } from './publicApiError'

describe('password verification compatibility', () => {
  it('accepts a matching CoachLink SHA-256 password hash', () => {
    const storedHash = hashPassword('correct-password')

    expect(isPasswordHash(storedHash)).toBe(true)
    expect(verifyPassword('correct-password', storedHash)).toBe(true)
    expect(verifyPassword('wrong-password', storedHash)).toBe(false)
  })

  it.each([null, undefined, '', 'wechat_openid', 'not-a-hex-password-hash'])(
    'rejects a non-password marker without throwing: %s',
    (storedHash) => {
      expect(isPasswordHash(storedHash)).toBe(false)
      expect(() => verifyPassword('123456', storedHash)).not.toThrow()
      expect(verifyPassword('123456', storedHash)).toBe(false)
    },
  )

  it('does not expose timingSafeEqual buffer errors to API clients', () => {
    expect(toPublicApiMessage(new RangeError('Input buffers must have the same byte length'), '登录失败，请稍后重试'))
      .toBe('登录失败，请稍后重试')
  })
})
