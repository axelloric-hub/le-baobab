/**
 * Coloration syntaxique minimale (Python et pseudo-formules), sans bibliothèque :
 * suffisante pour les extraits courts des articles et des guides.
 */
export type CodeTone = "plain" | "comment" | "string" | "keyword" | "decorator" | "number" | "function" | "builtin";

export interface CodeToken {
  tone: CodeTone;
  text: string;
}

const KEYWORDS = new Set([
  "from", "import", "as", "def", "async", "await", "return", "if", "elif", "else", "not", "and", "or", "in",
  "is", "for", "while", "with", "try", "except", "finally", "raise", "class", "pass", "None", "True", "False", "lambda",
]);
const BUILTINS = new Set(["str", "int", "dict", "list", "bool", "print", "len", "min", "max"]);

const TOKEN_RE =
  /(#.*$)|([rbf]?"(?:[^"\\]|\\.)*"|[rbf]?'(?:[^'\\]|\\.)*')|(@[A-Za-z_][\w.]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/gm;

export function highlightLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let last = 0;
  let previousWord = "";
  for (const match of line.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ tone: "plain", text: line.slice(last, index) });
    const [text, comment, string, decorator, number, word] = match;
    let tone: CodeTone = "plain";
    if (comment) tone = "comment";
    else if (string) tone = "string";
    else if (decorator) tone = "decorator";
    else if (number) tone = "number";
    else if (word) {
      if (KEYWORDS.has(word)) tone = "keyword";
      else if (previousWord === "def") tone = "function";
      else if (BUILTINS.has(word)) tone = "builtin";
      previousWord = word;
    }
    tokens.push({ tone, text });
    last = index + text.length;
  }
  if (last < line.length) tokens.push({ tone: "plain", text: line.slice(last) });
  return tokens;
}
