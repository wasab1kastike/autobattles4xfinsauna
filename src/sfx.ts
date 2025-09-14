export const sfx = {
  _sounds: new Map<string, HTMLAudioElement>(),
  register(name: string, audio: HTMLAudioElement): void {
    this._sounds.set(name, audio);
  },
  play(name: string): void {
    const audio = this._sounds.get(name);
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play();
  }
};
