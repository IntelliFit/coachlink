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

export type LeaderboardFormInput =
    | LeaderboardNumberInput
    | LeaderboardTextInput
    | LeaderboardOptionInput;
export interface LeaderboardRule {
    detail: string;
    status: "success" | "warning" | "error";
}
