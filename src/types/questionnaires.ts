export interface TrainingTagsQuestion {
    type: "tags";
    userSelections?: string[];
}

export interface TrainingTimesQuestion {
    type: "times";
    userSelection?: number;
}

export interface TrainingRmQuestion {
    type: "rm";
    userInputs?: Record<string, number>;
}

export interface TrainingOptionQuestion {
    type: "option";
    question: string;
    options: string[];
    scope?: "global" | "action"; // 区分问题类型：global=全局匹配，action=动作选择，默认action
    userSelection?: number;
}

export interface TrainingTextQuestion {
    type: "text";
    question: string;
    userSelection?: string;
}

export type QuestionType = "tags" | "times" | "option" | "text" | "rm";

export type TrainingItem =
    | TrainingTagsQuestion
    | TrainingTimesQuestion
    | TrainingOptionQuestion
    | TrainingTextQuestion
    | TrainingRmQuestion;
