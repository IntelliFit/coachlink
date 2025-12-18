
export interface TrainingTagsQuestion {
    type: 'tags'
    userSelections?: string[]
}

export interface TrainingTimesQuestion {
    type: 'times'
    userSelection?: number
}

export interface TrainingRmQuestion {
    type: 'rm'
    userInputs?: Record<string, number>
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
    userSelection?: string
}


export type QuestionType = 'tags' | 'times' | 'option' | 'text' | 'rm';

export type TrainingItem = TrainingTagsQuestion | TrainingTimesQuestion | TrainingOptionQuestion | TrainingTextQuestion | TrainingRmQuestion; 