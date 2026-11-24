export async function consumeNdjsonStream<T extends { tipo: string }>(
  response: Response,
  onEvent: (event: T) => void
): Promise<boolean> {
  if (!response.body) return false;
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let remainder = "";
  let completed = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    remainder += decoder.decode(value, { stream: true });
    const lines = remainder.split("\n");
    remainder = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as T;
        if (parsed.tipo === "concluido") completed = true;
        onEvent(parsed);
      } catch {
        // ignora linha corrompida isolada
      }
    }
  }

  if (remainder.trim()) {
    try {
      const parsed = JSON.parse(remainder) as T;
      if (parsed.tipo === "concluido") completed = true;
      onEvent(parsed);
    } catch {
      // ignora
    }
  }

  return completed;
}
