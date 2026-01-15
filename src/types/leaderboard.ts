export interface LeaderboardNumberInput {
    type: "number";
    name: string;
    required?: boolean;
    userInput?: number;
}

export interface LeaderboardTextInput {
    type: "text";
    name: string;
    required?: boolean;
    userInput?: string;
}

export interface LeaderboardOptionInput {
    type: "option";
    name: string;
    options: string[];
    required?: boolean;
    userInput?: string;
}

export interface LeaderboardVideoInput {
    type: "video";
    // TODO: 完成这部分的实现
    name: string;
}

export type LeaderboardFormInput =
    | LeaderboardNumberInput
    | LeaderboardTextInput
    | LeaderboardOptionInput
    | LeaderboardVideoInput;

export interface LeaderboardRule {
    detail: string;
    status: "success" | "warning" | "error";
}
