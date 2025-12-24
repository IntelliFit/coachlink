export interface LeaderboardNumberInput {
    type: "number";
    name: string;
    userInput?: number;
}

export interface LeaderboardTextInput {
    type: "text";
    name: string;
    userInput?: string;
}

export interface LeaderboardOptionInput {
    type: "option";
    name: string;
    options: string[];
    userInput?: string;
}

export type LeaderboardFormInput = LeaderboardNumberInput | LeaderboardTextInput | LeaderboardOptionInput;
export interface LeaderboardRule {
    detail: string;
    status: 'success' | 'warning' | 'error';
}