# Mini AI — Experimento de Grafo de Palavras

> Nasceu como experimento: *"e se eu criasse uma IA que não é rede neural, só um mapa de palavras com pesos?"*

![Bun](https://img.shields.io/badge/runtime-Bun-black)
![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6)
![Deps](https://img.shields.io/badge/dependências-0-brightgreen)

---

## Sumário

- [O que é](#o-que-é)
- [Como funciona](#como-funciona)
- [Anti-alucinação](#anti-alucinação)
- [Estrutura](#estrutura)
- [Tipos](#tipos)
- [Configuração](#configuração)
- [Exemplos](#exemplos)
- [Como rodar](#como-rodar)
- [Como expandir](#como-expandir)
- [Limitações](#limitações)
- [Roadmap](#roadmap)
- [Por que isso funciona](#por-que-isso-funciona)

---

## O que é

Um gerador de texto baseado em **grafo de associação ponderada** (cadeia de Markov) com **funções executáveis** para matemática. Zero dependência. Roda em **Bun + TypeScript**.

Não é uma rede neural. Não tem embeddings. Não tem backpropagation. É um `Map<string, WordEntry>` + `Math.random()`.

---

## Como funciona

```
Input
  │
  ├─→ isMathExpr()? → solve() → resultado exato (parser Shunting-Yard)
  │
  ├─→ match() → confidence < 0.3? → "não entendi"
  │
  └─→ generate() → amostragem ponderada → texto
```

### O grafo

Cada palavra possui:

| Campo | Função |
|-------|--------|
| `next` | O que pode vir depois (com peso de probabilidade) |
| `aliases` | Sinônimos que resolvem para a mesma entrada |
| `emotion` | Influencia a pontuação final (`!`, `.`, `?`) |

### Geração

1. Pega a palavra atual
2. Consulta `next` no `Map`
3. Sorteia a próxima palavra (amostragem ponderada com temperatura)
4. Repete até `maxWords` ou palavra terminal (`?`, `.`, `!`)

### Parser matemático

Se o input tem números + operadores, **calcula** (não gera). Usa Shunting-Yard → RPN → avaliação.

Suporta: `+` `-` `*` `/` `^`, parênteses e precedência.

---

## Anti-alucinação

O modelo **pode se recusar**. Cada camada filtra antes de gerar:

| Camada | Efeito |
|--------|--------|
| `isMathExpr()` + `solve()` | Calcula, não gera |
| `MIN_CONFIDENCE = 0.3` | Recusa se não reconhece o input |
| `confidence < 0.5` → 4 palavras | Baixa confiança = resposta curta |
| `PRECISION = 0.85` (`TEMP = 0.15`) | Quase sempre a opção mais provável |
| Anti-loop (`×0.2` por repetição) | Para em 3x a mesma palavra |
| Emoção → pontuação | Garante frase completa |

> **Princípio:** só gera quando tem certeza, calcula quando pode calcular e recusa quando não sabe.

---

## Estrutura

```
├── model.ts          # Motor (match, generate, parser, CLI)
├── types.ts          # Tipos (WordEntry, TrainingData)
├── training.json     # Grafo (~35 palavras)
└── README.md
```

---

## Tipos

```typescript
interface WordEntry {
  word: string;
  next: Record<string, number>;       // transições
  aliases: Record<string, number>;    // sinônimos
  emotion: "neutro" | "feliz" | "triste" | "surpreso" | "bravo" | "calmo";
  fn?: string;                        // função executável (opcional)
}
```

---

## Configuração

```typescript
const PRECISION = 0.85;       // 0.1 = caótico | 0.9 = rígido
const TEMP = 1.0 - PRECISION; // → 0.15
const MAX_WORDS = 8;
const MIN_CONFIDENCE = 0.3;
```

| `PRECISION` | Comportamento |
|-------------|---------------|
| `0.9` | Quase determinístico |
| `0.85` | Preciso, varia pouco |
| `0.7` | Equilibrado |
| `0.4` | Criativo, às vezes desvia |
| `0.1` | Caótico |

---

## Exemplos

```
você: 7 + (9 / 2)
ai: 7+(9/2) = 11.5!

você: 2 * 3 + 4
ai: 2*3+4 = 10!

você: (1+2) * (3+4)
ai: (1+2)*(3+4) = 21!

você: 2 ^ 10
ai: 2^10 = 1024!

você: oi
ai: oi vamos lá!

você: dica
ai: dica é: parênteses primeiro!

você: não sei
ai: não se preocupe!

você: xyz
ai: não entendi, pode repetir?

você: sair
ai: tchau!
```

---

## Como rodar

```bash
bun ai
```

---

## Como expandir

| O que | Como |
|-------|------|
| Nova palavra | Adicionar entry no `training.json` |
| Nova função | Adicionar em `FNS` no `model.ts` |
| Mais precisão | Subir `PRECISION` para `0.9` |
| Mais criatividade | Baixar `PRECISION` para `0.5` |
| Ordem 2 (contexto) | `next` vira array, usa `history` |
| Feedback | Gravar pesos alterados de volta no JSON |

---

## Limitações

- Não generaliza: palavra nova = entrada nova
- Texto longo diverge (sem memória de 3+ palavras)
- Criatividade é recombinatória (variações, não rupturas)
- Vocabulário fechado: o que não está no grafo, não existe

---

## Roadmap

| Fase | Status |
|------|--------|
| 1 — Grafo + funções + parser | ✅ |
| 2 — Ordem 2 (2 palavras de contexto) | ⬜ |
| 3 — Templates com slots | ⬜ |
| 4 — Memória de sessão | ⬜ |
| 5 — Feedback (aprender com correção) | ⬜ |
| 6 — Híbrido (grafo + SLM) | ⬜ |

---

## Por que isso funciona

O modelo ficou bom **não por ter mais palavras**, mas por saber **quando não gerar**. Diferente de uma rede neural (que sempre produz algo), este modelo pode:

1. **Calcular** — matemática → parser exato
2. **Recusar** — não reconheceu → "não entendi"
3. **Gerar curto** — baixa confiança → 4 palavras
4. **Gerar normal** — alta confiança → 8 palavras

Cada decisão é determinística. A aleatoriedade só entra na escolha da próxima palavra, e mesmo assim, com `TEMP = 0.15`, a opção mais provável domina.

---

<sub>Experimento iniciado em 2026 · Zero dependência · ~35 palavras · ~150 linhas de código</sub>
