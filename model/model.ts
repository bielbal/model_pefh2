// model.ts
import { readFileSync } from "fs";
import { createInterface } from "readline";
import type { WordEntry, TrainingData, FnMap } from "./types";

// ─── Parser de expressões matemáticas ──────────────────────────
// Suporta: +, -, *, /, ^, parênteses, precedência, números decimais

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const c: any = expr[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
      tokens.push(num);
    } else if ("+-*/^()".includes(c)) {
      tokens.push(c);
      i++;
    } else {
      i++; // ignora caracteres desconhecidos
    }
  }
  return tokens;
}

// Shunting-Yard → RPN → avaliar
function shuntingYard(tokens: string[]): string[] {
  const output: string[] = [];
  const ops: string[] = [];
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };

  for (const t of tokens) {
    if (/^[0-9.]+$/.test(t)) {
      output.push(t);
    } else if (t === "(") {
      ops.push(t);
    } else if (t === ")") {
      while (ops.length && ops.at(-1) !== "(") output.push(ops.pop()!);
      ops.pop(); // remove "("
    } else if (t in prec) {
      while (ops.length && ops.at(-1) !== "(" && prec[ops.at(-1)!] >= prec[t]) {
        output.push(ops.pop()!);
      }
      ops.push(t);
    }
  }
  while (ops.length) output.push(ops.pop()!);
  return output;
}

function evalRPN(rpn: string[]): number {
  const stack: number[] = [];
  for (const t of rpn) {
    if (/^[0-9.]+$/.test(t)) {
      stack.push(parseFloat(t));
    } else {
      const b = stack.pop()!;
      const a = stack.pop()!;
      switch (t) {
        case "+": stack.push(a + b); break;
        case "-": stack.push(a - b); break;
        case "*": stack.push(a * b); break;
        case "/": stack.push(b === 0 ? NaN : a / b); break;
        case "^": stack.push(Math.pow(a, b)); break;
      }
    }
  }
  return stack[0] ?? NaN;
}

function solve(expr: string): string {
  const clean = expr.replace(/[=]/g, "").trim();
  const tokens = tokenize(clean);
  if (!tokens.length) return "expressão vazia!";

  const rpn = shuntingYard(tokens);
  const result = evalRPN(rpn);

  if (isNaN(result)) return "erro na expressão!";
  // Arredonda pra 4 casas se for decimal
  const formatted = Number.isInteger(result) ? String(result) : result.toFixed(4).replace(/\.?0+$/, "");
  return `${clean} = ${formatted}!`;
}

// ─── Detecta se é expressão matemática ─────────────────────────
function isMathExpr(input: string): boolean {
  const hasNum = /\d/.test(input);
  const hasOp = /[+\-*/^]/.test(input);
  const hasParen = /[()]/.test(input);
  return hasNum && (hasOp || hasParen);
}

// ─── Configuração ───────────────────────────────────────────────
const PRECISION = 0.85;
const TEMP = 1.0 - PRECISION;
const MAX_WORDS = 8;
const MIN_CONFIDENCE = 0.3;

// ─── Carrega e indexa ───────────────────────────────────────────
const raw = JSON.parse(readFileSync(import.meta.dir + "/training.json", "utf-8")) as TrainingData;

const idx = new Map<string, WordEntry>();
for (const e of raw) {
  idx.set(e.word.toLowerCase(), e);
  for (const alias of Object.keys(e.aliases)) idx.set(alias.toLowerCase(), e);
}

// ─── Match ──────────────────────────────────────────────────────
const STOP = new Set(["o","a","os","as","que","de","do","da","e","em","no","na","um","uma","é","ser","está","tá","meu","minha","seu","sua","com","por","para","pra","qual","quais"]);

function match(input: string): { start: string; confidence: number } {
  const words: any = input.toLowerCase().split(/\s+/).filter(w => w.length > 1 && !STOP.has(w) && !/\d/.test(w));
  if (!words.length) return { start: "", confidence: 0 };

  for (let n = words.length; n >= 1; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(" ");
      if (idx.has(phrase)) return { start: phrase, confidence: n / words.length };
    }
  }
  for (let i = words.length - 1; i >= 0; i--) {
    if (idx.has(words[i])) return { start: words[i], confidence: 1 / words.length };
  }
  return { start: "", confidence: 0 };
}

// ─── Geração ────────────────────────────────────────────────────
function generate(start: string, maxWords = MAX_WORDS): string {
  const out: string[] = [start];
  let cur = start;
  const seen = new Map<string, number>();
  let emotion: WordEntry["emotion"] = "neutro";

  for (let i = 0; i < maxWords; i++) {
    const entry = idx.get(cur);
    if (!entry || !Object.keys(entry.next).length) break;
    emotion = entry.emotion;

    if (entry.fn) break; // não executa fn aqui (já tratado no tryFn)

    const candidates: any = Object.entries(entry.next).map(([w, s]) => {
      const count = seen.get(w) ?? 0;
      return [w, s * Math.pow(0.2, count)] as [string, number];
    });

    const weights:  any = candidates.map(([, s]) => Math.pow(s, 1 / TEMP));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;

    cur = "";
    for (let j = 0; j < candidates.length; j++) {
      r -= weights[j];
      if (r <= 0) { cur = candidates[j][0]; break; }
    }
    if (!cur) cur = candidates[candidates.length - 1][0];

    seen.set(cur, (seen.get(cur) ?? 0) + 1);
    if ((seen.get(cur) ?? 0) > 2) break;
    out.push(cur);
    if (["?", ".", "!"].includes(cur)) break;
  }

  let text = out.join(" ");
  if (!/[?.!]$/.test(text)) {
    text += emotion === "feliz" ? "!" : emotion === "triste" ? "." : "?";
  }
  return text;
}

// ─── Loop interativo ────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask() {
  rl.question("você: ", (input) => {
    const clean = input.trim();
    if (clean === "sair") { console.log("ai: tchau!"); rl.close(); return; }
    if (!clean) return ask();

    // 1. Expressão matemática?
    if (isMathExpr(clean)) {
      console.log("ai:", solve(clean));
      return ask();
    }

    // 2. Match no grafo
    const { start, confidence } = match(clean);
    if (!start || confidence < MIN_CONFIDENCE) {
      console.log("ai: não entendi, pode repetir?");
    } else {
      const maxW = confidence < 0.5 ? 4 : MAX_WORDS;
      console.log("ai:", generate(start, maxW));
    }
    ask();
  });
}

ask();   