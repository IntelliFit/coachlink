
export interface TrainingTagsQuestion {
    type: 'tags'
}

export interface TrainingTimesQuestion {
    type: 'times'
}

export interface TrainingOptionQuestion {
    type: 'option'
    options: string[]
}

export interface TrainingTextQuestion {
    type: 'text'
    question: string
}

export type TrainingItem = TrainingTagsQuestion | TrainingTimesQuestion | TrainingOptionQuestion | TrainingTextQuestion; 