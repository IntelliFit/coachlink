import { canSwitchCoachLinkAppRole, resolveCoachLinkAppRole, type CoachLinkUser } from '../../packages/core/src'

function user(overrides: Partial<CoachLinkUser> = {}): CoachLinkUser {
  return {
    id: 'user-1',
    primary_role: 'student',
    is_coach: false,
    ...overrides,
  }
}

describe('mobile app role model', () => {
  it('keeps an approved coach in the student surface when student is selected', () => {
    expect(resolveCoachLinkAppRole(user({ is_coach: true, primary_role: 'student' }))).toBe('student')
  })

  it('enters the coach surface only when coach is selected and eligible', () => {
    expect(resolveCoachLinkAppRole(user({ is_coach: true, primary_role: 'coach' }))).toBe('coach')
    expect(resolveCoachLinkAppRole(user({ is_coach: false, primary_role: 'coach' }))).toBe('student')
  })

  it('uses the student surface for missing and legacy roles', () => {
    expect(resolveCoachLinkAppRole(null)).toBe('student')
    expect(resolveCoachLinkAppRole(user({ primary_role: null, is_coach: true }))).toBe('student')
    expect(resolveCoachLinkAppRole(user({ primary_role: 'admin', is_coach: true }))).toBe('student')
  })

  it('allows every signed-in user to select student but guards coach selection', () => {
    expect(canSwitchCoachLinkAppRole(user(), 'student')).toBe(true)
    expect(canSwitchCoachLinkAppRole(user(), 'coach')).toBe(false)
    expect(canSwitchCoachLinkAppRole(user({ is_coach: true }), 'coach')).toBe(true)
    expect(canSwitchCoachLinkAppRole(null, 'student')).toBe(false)
  })
})
