//
// Sends a tick event at 24 PPQ to recreate a MIDI clock signal
// Register listeners with newTicker.addEventListener('tick', ()=>{ some code })
//

let PPQ = 24

export class ClockTicker extends EventTarget {
  constructor(tempo = 120) {
    super()

    this.pos = 0
    this.length = (60 * 1000) / (tempo * PPQ)

    this.tick()
  }

  getInterval() {
    return this.length
  }

  tick() {
    if (!this.pos) {
      this.pos = performance.now()
    }
    this.pos += this.length
    let diff = this.pos - performance.now()

    // Notify listeners
    this.dispatchEvent(new Event('tick'))

    // Schedule next tick
    setTimeout(() => {
      this.tick()
    }, diff)
  }
}
