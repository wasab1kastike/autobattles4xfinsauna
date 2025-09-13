export class Unit {
  constructor(pos, color) {
    this.pos = pos; // { q, r }
    this.color = color;
    this.speed = 1; // hexes per second
  }

  update(dt, map, units) {
    // Placeholder for AI logic
    // e.g., move toward nearest enemy or wander
  }

  render(ctx, map) {
    const { x, y } = map.hexToPixel(this.pos);
    ctx.beginPath();
    ctx.arc(x, y, map.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}
