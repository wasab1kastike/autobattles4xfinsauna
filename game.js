import { HexMap } from './hexmap.js';
import { Unit } from './unit.js';

export class Game {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.map = new HexMap(10, 10);
    this.units = [
      new Unit({ q: 0, r: 0 }, 'blue'),
      new Unit({ q: 5, r: 5 }, 'red')
    ];
    this.lastTime = 0;
  }

  start() {
    requestAnimationFrame(this.loop.bind(this));
  }

  loop(time) {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }

  update(dt) {
    this.units.forEach(u => u.update(dt, this.map, this.units));
  }

  render() {
    const { ctx } = this;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.map.render(ctx);
    this.units.forEach(u => u.render(ctx, this.map));
  }
}
