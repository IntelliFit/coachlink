
export interface TrainingTagsQuestion {
    type: 'tags'
}

export interface TrainingTimesQuestion {
    type: 'times'
}

export interface TrainingOptionQuestion {
    type: 'option'
    question: string
    options: string[]
    userSelection?: number
}

export interface TrainingTextQuestion {
    type: 'text'
    question: string
}

export type QuestionType = 'tags' | 'times' | 'option' | 'text';

export type TrainingItem = TrainingTagsQuestion | TrainingTimesQuestion | TrainingOptionQuestion | TrainingTextQuestion; 