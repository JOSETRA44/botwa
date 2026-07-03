// Detección y renderizado de fórmulas LaTeX. Extraído de bot.js en la
// Etapa 4 de la reestructuración — comportamiento idéntico.
export function detectLatexFormulas(text) {
  const formulas = [];

  // Detectar fórmulas en bloque: $$...$$
  const blockRegex = /\$\$([\s\S]*?)\$\$/g;
  let match;

  while ((match = blockRegex.exec(text)) !== null) {
    formulas.push({
      type: 'block',
      latex: match[1].trim(),
      original: match[0],
      index: match.index
    });
  }

  // Detectar fórmulas inline: $...$
  const inlineRegex = /\$([^\$\n]+?)\$/g;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Evitar detectar las ya encontradas en bloques
    const isInBlock = formulas.some(f =>
      match.index >= f.index && match.index < f.index + f.original.length
    );

    if (!isInBlock) {
      formulas.push({
        type: 'inline',
        latex: match[1].trim(),
        original: match[0],
        index: match.index
      });
    }
  }

  return formulas;
}

// Renderizar fórmula LaTeX como imagen usando CodeCogs API (gratuita, sin
// key). fetchImpl inyectable para poder probar sin red real.
export async function renderLatexToImage(latex, { fetchImpl = fetch } = {}) {
  try {
    // Limpiar y codificar la fórmula
    const cleanLatex = latex.trim();
    const encodedLatex = encodeURIComponent(cleanLatex);

    // Formato: png, tamaño: grande (300 DPI), color: negro
    const imageUrl = `https://latex.codecogs.com/png.latex?\\dpi{300}\\bg_white\\large ${encodedLatex}`;

    const response = await fetchImpl(imageUrl);

    if (!response.ok) {
      throw new Error(`Error al renderizar: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);

  } catch (error) {
    console.error('❌ Error al renderizar LaTeX:', error.message);
    return null;
  }
}
