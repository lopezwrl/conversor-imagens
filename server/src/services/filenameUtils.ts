const CARACTERES_INVALIDOS = /[\\/:*?"<>|]/g;
const CARACTERES_CONTROLE = /[\x00-\x1f\x7f-\x9f]/g;
const COR_HEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function sanitizarNomeArquivo(nome?: string | null): string {
  if (!nome) return "";
  try {
    return String(nome)
      .replace(CARACTERES_INVALIDOS, "")
      .replace(CARACTERES_CONTROLE, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/, "")
      .trim();
  } catch {
    return "";
  }
}

export function extensaoDoArquivo(nome: string): string {
  if (!nome || !nome.includes(".")) return "";
  return nome.split(".").pop()!.toLowerCase();
}

export function nomeBaseSemExtensao(nome: string): string {
  const idx = nome.lastIndexOf(".");
  return idx > 0 ? nome.slice(0, idx) : nome;
}

export function resolverNomeSaida(
  nomeBase: string,
  novoNome: string | null | undefined,
  extensao: string,
  nomesUsados: Set<string>,
  fallback = "arquivo"
): string {
  const extLimpa = extensao.replace(/^\./, "").toLowerCase();
  const baseLimpa = sanitizarNomeArquivo(novoNome) || sanitizarNomeArquivo(nomeBase) || fallback;

  // Se o usuário já incluiu a extensão no novoNome, não duplica
  const semExtDuplicada = baseLimpa.toLowerCase().endsWith(`.${extLimpa}`)
    ? baseLimpa.slice(0, -(extLimpa.length + 1))
    : baseLimpa;

  const candidato = semExtDuplicada || fallback;
  const tentativaInicial = `${candidato}.${extLimpa}`;
  if (!nomesUsados.has(tentativaInicial.toLowerCase())) {
    nomesUsados.add(tentativaInicial.toLowerCase());
    return tentativaInicial;
  }

  let contador = 1;
  while (true) {
    const tentativa = `${candidato}_${contador}.${extLimpa}`;
    if (!nomesUsados.has(tentativa.toLowerCase())) {
      nomesUsados.add(tentativa.toLowerCase());
      return tentativa;
    }
    contador++;
  }
}

export function corHexParaRgb(
  cor?: string | null,
  padrao: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 }
): { r: number; g: number; b: number } {
  if (!cor || !COR_HEX.test(cor.trim())) return padrao;
  let hex = cor.trim().replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function mensagemAmigavelErro(err: unknown): string {
  const texto = err instanceof Error ? err.message : String(err ?? "");
  const lower = texto.toLowerCase();

  if (lower.includes("memory") || lower.includes("allocation")) {
    return "O arquivo é grande demais para a memória disponível no momento.";
  }
  if (lower.includes("unsupported image format") || lower.includes("input buffer contains unsupported")) {
    return "Não foi possível reconhecer este arquivo como uma imagem válida (pode estar corrompido ou em formato não suportado).";
  }
  if (lower.includes("premature end") || lower.includes("truncated") || lower.includes("corrupt")) {
    return "O arquivo parece estar incompleto ou corrompido.";
  }
  if (lower.includes("encrypted") || lower.includes("password")) {
    return "Este documento está protegido por senha e não pode ser processado.";
  }
  return texto || "Erro inesperado ao processar este arquivo.";
}
