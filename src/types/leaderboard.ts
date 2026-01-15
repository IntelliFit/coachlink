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
    name: string;
    // 上传的链接
    userInput: string;
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
