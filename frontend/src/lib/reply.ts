const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" };

/**
 * The agent is prompted to answer as `{"chat_message": "...", "suggestion": ...}`
 * but the stream forwards that JSON as plain text. Pull out the readable part,
 * tolerating a document that is still arriving. Plain text passes through.
 */
export function readableReply(raw: string): string {
    const text = raw.trimStart();
    if (!text.startsWith("{")) return raw;

    const key = /"chat_message"\s*:\s*"/.exec(text);
    if (!key) return "";

    let out = "";
    let i = key.index + key[0].length;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"') return out;
        if (ch !== "\\") {
            out += ch;
            i += 1;
            continue;
        }
        const next = text[i + 1];
        if (next === undefined) return out;
        if (next === "u") {
            const hex = text.slice(i + 2, i + 6);
            if (hex.length < 4) return out;
            out += /^[0-9a-f]{4}$/i.test(hex) ? String.fromCharCode(parseInt(hex, 16)) : hex;
            i += 6;
            continue;
        }
        out += ESCAPES[next] ?? next;
        i += 2;
    }
    return out;
}
