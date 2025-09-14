export function raiderSVG(scale: number): string {
  const size = 32 * scale;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" stroke="currentColor" stroke-width="2">
  <polygon points="4,2 18,16 4,30" />
  <circle cx="24" cy="16" r="6" />
</svg>`;
}

export default { raiderSVG };
