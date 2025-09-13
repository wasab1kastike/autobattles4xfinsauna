export class HexMap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.size = 32; // pixel radius of each hex
  }

  hexToPixel({ q, r }) {
    const x = this.size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = this.size * (3 / 2) * r;
    return { x, y };
  }

  render(ctx) {
    for (let q = 0; q < this.width; q++) {
      for (let r = 0; r < this.height; r++) {
        const { x, y } = this.hexToPixel({ q, r });
        this.drawHex(ctx, x, y, '#ddd');
      }
    }
  }

  drawHex(ctx, x, y, color) {
    const s = this.size;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i;
      ctx.lineTo(x + s * Math.cos(angle), y + s * Math.sin(angle));
    }
    ctx.closePath();
    ctx.strokeStyle = '#555';
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  }
}
