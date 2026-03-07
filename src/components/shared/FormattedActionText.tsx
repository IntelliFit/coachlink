import React from "react";

type FormattedActionTextProps = {
    text?: string | null;
    emptyText?: string;
    className?: string;
    lineClampClassName?: string;
};

function renderInlineWithMarks(line: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const pattern = /(\*\*[^*]+\*\*|==[^=]+==)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = null;

    while ((match = pattern.exec(line)) !== null) {
        const raw = match[0];
        const start = match.index;
        if (start > lastIndex) {
            nodes.push(line.slice(lastIndex, start));
        }

        if (raw.startsWith("**") && raw.endsWith("**")) {
            const content = raw.slice(2, -2);
            nodes.push(
                <strong key={`${start}-b`} className="font-bold text-surface-900">
                    {content}
                </strong>,
            );
        } else if (raw.startsWith("==") && raw.endsWith("==")) {
            const content = raw.slice(2, -2);
            nodes.push(
                <mark
                    key={`${start}-m`}
                    className="bg-yellow-200/80 text-surface-900 px-0.5 rounded-sm"
                >
                    {content}
                </mark>,
            );
        } else {
            nodes.push(raw);
        }

        lastIndex = start + raw.length;
    }

    if (lastIndex < line.length) {
        nodes.push(line.slice(lastIndex));
    }
    return nodes;
}

export default function FormattedActionText(props: FormattedActionTextProps) {
    const { text, emptyText = "暂无描述", className = "", lineClampClassName = "" } = props;
    const value = (text || "").trim();

    if (!value) {
        return <span className={className}>{emptyText}</span>;
    }

    const lines = value.split("\n");

    return (
        <div className={`${className} ${lineClampClassName}`.trim()}>
            {lines.map((line, idx) => (
                <React.Fragment key={`line-${idx}`}>
                    {renderInlineWithMarks(line)}
                    {idx < lines.length - 1 && <br />}
                </React.Fragment>
            ))}
        </div>
    );
}


