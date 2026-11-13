/**
 * Evaluator formula aman (tanpa eval) untuk template kebutuhan material.
 * Mendukung: angka, variabel, + - * / ^, kurung, fungsi ceil/floor/round/min/max/abs.
 * Contoh: "ceil(panjang * 2.2) + laci", "max(1, panjang / 3)".
 */

type Token = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

const FUNCS: Record<string, (...a: number[]) => number> = {
  ceil: (x) => Math.ceil(x),
  floor: (x) => Math.floor(x),
  round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  abs: (x) => Math.abs(x),
};

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      // Desimal memakai titik (koma adalah pemisah argumen fungsi).
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      const v = Number(raw);
      if (!Number.isFinite(v)) throw new Error(`Angka tidak valid: ${raw}`);
      out.push({ t: "num", v });
      i = j;
    } else if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j).toLowerCase() });
      i = j;
    } else if ("+-*/^(),".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
    } else {
      throw new Error(`Karakter tidak dikenal: ${c}`);
    }
  }
  return out;
}

/** Hitung formula. Melempar Error dengan pesan Indonesia jika formula salah. */
export function evaluateFormula(formula: string, vars: Record<string, number>): number {
  if (formula.length > 300) throw new Error("Formula terlalu panjang");
  const tokens = tokenize(formula);
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (v?: string) => {
    const tk = tokens[pos];
    if (!tk || (v !== undefined && !(tk.t === "op" && tk.v === v))) throw new Error(v ? `Diharapkan "${v}"` : "Formula tidak lengkap");
    pos++;
    return tk;
  };

  function expr(): number {
    let v = term();
    while (peek()?.t === "op" && (peek()!.v === "+" || peek()!.v === "-")) {
      const op = eat().v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = power();
    while (peek()?.t === "op" && (peek()!.v === "*" || peek()!.v === "/")) {
      const op = eat().v;
      const r = power();
      if (op === "/" && r === 0) throw new Error("Pembagian dengan nol");
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function power(): number {
    const base = unary();
    if (peek()?.t === "op" && peek()!.v === "^") {
      eat();
      return base ** power();
    }
    return base;
  }
  function unary(): number {
    if (peek()?.t === "op" && peek()!.v === "-") {
      eat();
      return -unary();
    }
    if (peek()?.t === "op" && peek()!.v === "+") {
      eat();
      return unary();
    }
    return primary();
  }
  function primary(): number {
    const tk = eat();
    if (tk.t === "num") return tk.v;
    if (tk.t === "op" && tk.v === "(") {
      const v = expr();
      eat(")");
      return v;
    }
    if (tk.t === "id") {
      if (peek()?.t === "op" && peek()!.v === "(") {
        const fn = FUNCS[tk.v];
        if (!fn) throw new Error(`Fungsi tidak dikenal: ${tk.v}`);
        eat("(");
        const args: number[] = [];
        if (!(peek()?.t === "op" && peek()!.v === ")")) {
          args.push(expr());
          while (peek()?.t === "op" && peek()!.v === ",") {
            eat();
            args.push(expr());
          }
        }
        eat(")");
        return fn(...args);
      }
      if (!(tk.v in vars)) throw new Error(`Variabel tidak dikenal: ${tk.v}`);
      return vars[tk.v];
    }
    throw new Error("Formula tidak valid");
  }

  const v = expr();
  if (pos < tokens.length) throw new Error("Formula tidak valid di dekat akhir");
  if (!Number.isFinite(v)) throw new Error("Hasil formula bukan angka");
  return v;
}

/** Hasil kebutuhan: formula × (1 + sisa%) lalu dibulatkan ke atas (2 desimal jika tidak dibulatkan). */
export function materialQty(formula: string, vars: Record<string, number>, wastePct: number, roundUp: boolean) {
  const raw = evaluateFormula(formula, vars) * (1 + (wastePct || 0) / 100);
  const v = roundUp ? Math.ceil(raw - 1e-9) : Math.round(raw * 100) / 100;
  return Math.max(0, v);
}
