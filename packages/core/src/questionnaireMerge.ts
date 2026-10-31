/** 把学员已有的问卷答案合到教练当前的题目上，小程序和 APP 的学员档案共用。 */

export type QuestionnaireMergeItem = {
  id?: string
  type?: string
  question?: string
  options?: Array<string | number>
  userSelection?: string | number
  userSelections?: string[]
  userInputs?: Record<string, number | string>
  answer?: string
}

/** 每份问卷只有一道的题型：教练删了重建后 id 会变，答案仍然是同一件事。 */
const SINGLETON_TYPES = ['tags', 'times', 'rm']

function questionnaireKey(item: QuestionnaireMergeItem) {
  if (item.id) return `id:${item.id}`
  if (item.type && SINGLETON_TYPES.indexOf(item.type) >= 0) return `type:${item.type}`
  if (item.question) return `${item.type || 'text'}:${item.question}`
  return String(item.type || 'text')
}

function questionTextKey(item: QuestionnaireMergeItem) {
  return item.question ? `${item.type || 'text'}:${item.question}` : ''
}

function optionsKey(item: QuestionnaireMergeItem) {
  return item.type === 'option' && Array.isArray(item.options) && item.options.length > 0 ? `opt:${item.options.join('|')}` : ''
}

/**
 * 先按 id 匹配，再按题干、选项匹配，最后按题型顺序兜底（旧答案没有 id、或题干改过）。
 * 兜底很重要：1RM 没匹配上时空题排在前面、真实答案落到最后，而读 1RM 的接口只认第一道，结果就成了「没填」。
 * 两边都有 id 且不同的普通题是两道不同的题，不兜底，否则「伤病史」的回答会跑到新题下面。
 * 教练之后删掉的题，学员的答案排在最后保留，否则保存时会被丢掉。
 */
export function mergeQuestionnaireAnswers<T extends QuestionnaireMergeItem>(questions: T[], existingAnswers: T[]): T[] {
  const byKey = new Map<string, T>()
  const byText = new Map<string, T>()
  const byOptions = new Map<string, T>()
  existingAnswers.forEach((item) => {
    byKey.set(questionnaireKey(item), item)
    const textKey = questionTextKey(item)
    if (textKey && !byText.has(textKey)) byText.set(textKey, item)
    const key = optionsKey(item)
    if (key && !byOptions.has(key)) byOptions.set(key, item)
  })

  const used = new Set<T>()
  const matches = new Map<T, T>()
  const take = (question: T, answer: T | undefined) => {
    if (!answer || used.has(answer)) return false
    used.add(answer)
    matches.set(question, answer)
    return true
  }

  questions.forEach((question) => {
    take(question, byKey.get(questionnaireKey(question)))
  })
  questions.forEach((question) => {
    if (matches.has(question)) return
    const textKey = questionTextKey(question)
    if (textKey && take(question, byText.get(textKey))) return
    const key = optionsKey(question)
    if (key) take(question, byOptions.get(key))
  })
  questions.forEach((question) => {
    if (matches.has(question)) return
    const type = question.type || 'text'
    take(question, existingAnswers.filter((answer) => (
      !used.has(answer)
      && (answer.type || 'text') === type
      && (SINGLETON_TYPES.indexOf(type) >= 0 || !answer.id)
    ))[0])
  })

  const merged = questions.map((question) => {
    const answer = matches.get(question)
    if (!answer) return question
    if (question.type === 'tags') return { ...question, userSelections: answer.userSelections || [] }
    // 服务端按动作名生成了 userInputs；学员没填的动作也要留着输入框
    if (question.type === 'rm') return { ...question, userInputs: { ...(question.userInputs || {}), ...(answer.userInputs || {}) } }
    if (question.type === 'times' || question.type === 'option' || question.type === 'text') {
      return { ...question, userSelection: answer.userSelection ?? answer.answer ?? '' }
    }
    return { ...question, ...answer }
  })
  return [...merged, ...existingAnswers.filter((item) => !used.has(item))]
}
