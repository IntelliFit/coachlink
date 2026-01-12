export interface TrainingTagsQuestion {
    type: "tags";
    userSelections?: string[];
}

export interface TrainingTimesQuestion {
    type: "times";
    // 允许教练自定义题干（不填则使用默认文案）
    question?: string;
    // 允许教练配置可选项（例如 [3,4,5]）；不填则默认 1~7
    options?: number[];
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
