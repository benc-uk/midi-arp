// Global MIDI access
export let access

// Used for BPM calculations
let ticks = 0
let prevTicks = 0
let bpmListeners = []
let globalChannel = 1

const MSG_SYSTEM = 15
const PITCH_BEND = 14
const MSG_CHAN_AFTERTOUCH = 13
const MSG_PROG_CHANGE = 12
const MSG_CC = 11
const MSG_POLY_AFTERTOUCH = 10
const MSG_NOTE_ON = 9
const MSG_NOTE_OFF = 8

const DEBUG = true

// =================================================
// A map to help lookup descriptions of MIDI messages
// =================================================
const describeMessages = {
  14: {
    name: 'Pitch bend',
    value: 'amount'
  },
  13: {
    name: 'Channel aftertouch',
    value: 'pressure'
  },
  12: {
    name: 'Program',
    value: 'patch'
  },
  11: {
    name: 'Control',
    value: 'CC'
  },
  10: {
    name: 'Poly aftertouch',
    value: 'note'
  },
  9: {
    name: 'Note on ',
    value: 'note'
  },
  8: {
    name: 'Note off',
    value: 'note'
  }
}

// =================================================
// Attempt to get MIDI access and hold it globally
// =================================================
export async function getAccess() {
  try {
    if (!access) {
      access = await navigator.requestMIDIAccess({ sysex: false })
    }

    // Check BPM very 1 second
    setInterval(calcBPM, 1000)

    return access
  } catch (err) {
    console.error('MIDI getAccess failed', err)
  }
}

// =================================================
// Describe a MIDI message for logging
// =================================================
export function describeMessage(msg) {
  let status = byteToNibbles(msg.data[0])

  let cmd = status[0]
  let channel = status[1]

  let d = new Date()
  let msecs = ('00' + d.getMilliseconds()).slice(-3)
  let secs = ('0' + d.getSeconds()).slice(-2)
  let mins = ('0' + d.getMinutes()).slice(-2)
  let hrs = ('0' + d.getHours()).slice(-2)
  let timestamp = `${hrs}:${mins}:${secs}:${msecs}`

  // System common messages (clock, stop, start, etc)
  // Note. Here the channel nibble actually denotes message *sub-type* NOT the channel, as these messages are global
  if (cmd == MSG_SYSTEM) {
    let subcmd = ''

    // SysEx !!
    if (channel == 0) {
      return `${timestamp} — System exclusive START!`
    }
    // MIDI time code quarter frame, not logged!
    if (channel == 1) {
      return null
    }
    // Rarely used song pointer position
    if (channel == 2) {
      subcmd = `common: song position [${msg.data[1]}, ${msg.data[2]}]`
    }
    // Another rare one
    if (channel == 6) {
      return `common: tune request`
    }
    // SysEx !!
    if (channel == 7) {
      return `${timestamp} — System exclusive END!`
    }
    // Handle clock as a special case for BPM
    if (channel == 8) {
      ticks++
      // Return nothing, so clock messages are NOT logged
      return null
    }
    if (channel == 10) {
      subcmd = 'real-time: START'
      resetClock()
    }
    if (channel == 11) {
      subcmd = 'real-time: CONTINUE'
      resetClock()
    }
    if (channel == 12) {
      subcmd = 'real-time: STOP'
      resetClock()
    }
    if (subcmd) return `${timestamp} — System ${subcmd}`
  }

  // Capture 'Bank Select' CCs as a special case
  if (msg.data[1] == 0 && cmd == MSG_CC) return `${timestamp} — Bank Select | MSB: ${msg.data[2]} | channel: ${channel + 1}`
  if (msg.data[1] == 32 && cmd == MSG_CC) return `${timestamp} — Bank Select | LSB: ${msg.data[2]} | channel: ${channel + 1}`

  // Capture 'NRPN' as a special case
  if (msg.data[1] == 98 && cmd == MSG_CC) return `${timestamp} — NRPN | LSB: ${msg.data[2]} | channel: ${channel + 1}`
  if (msg.data[1] == 99 && cmd == MSG_CC) return `${timestamp} — NPRN | MSB: ${msg.data[2]} | channel: ${channel + 1}`
  if (msg.data[1] == 6 && cmd == MSG_CC) return `${timestamp} — NRPN Value | MSB: ${msg.data[2]} | channel: ${channel + 1}`
  if (msg.data[1] == 38 && cmd == MSG_CC) return `${timestamp} — NPRN Value | LSB: ${msg.data[2]} | channel: ${channel + 1}`

  // Describe most standard messages such a CC and note
  let desc = describeMessages[cmd]
  if (desc) {
    let value2Text = msg.data[2] ? ` value: ${msg.data[2]} |` : ''
    return `${timestamp} — ${desc.name} | ${desc.value}: ${msg.data[1]} |${value2Text} channel: ${channel + 1}`
  }

  // Fallback
  return `${timestamp} — Unknown (${cmd},${channel}) | value-1: ${msg.data[1]} | value-2: ${msg.data[2]} | channel: ${channel + 1}`
}

// ===================================================
// Split a byte into two nibbles
// ===================================================
export function byteToNibbles(byte) {
  const high = byte & 0xf
  const low = byte >> 4
  return [low, high]
}

// ===================================================
// Reset clock ticks
// ===================================================
export function resetClock() {
  ticks = 0
  prevTicks = 0
}

// ===================================================
// Called every second to calculate BPM
// ===================================================
function calcBPM() {
  if (prevTicks > 0) {
    let bpm = (ticks - prevTicks) * 2.5

    // Notify any listeners of new BPM
    for (let listener of bpmListeners) {
      listener(bpm)
    }
  }
  prevTicks = ticks
}

// ===================================================
// Add a listener to be notified of BPM changes
// ===================================================
export function addBPMListener(cb) {
  bpmListeners.push(cb)
}

// ===================================================
// Remove all BPM listeners
// ===================================================
export function removeBPMListeners() {
  bpmListeners = []
}

// =====================================================================================
// Send MIDI note ON
// =====================================================================================
export function sendNoteOn(midiOut, note, chan = 1, velo = 127) {
  if (!midiOut) return
  const channel = globalChannel > 0 ? globalChannel : chan

  console.log(midiOut)
  console.debug(`MIDI note on - note:${note}, velo:${velo}, channel:${channel}`)
  midiOut.send([0x90 + (channel - 1), note, velo])
}

// =====================================================================================
// Send MIDI note OFF, default velocity is zero
// =====================================================================================
export function sendNoteOff(midiOut, note, chan = 1, velo = 0) {
  if (!midiOut) return
  const channel = globalChannel > 0 ? globalChannel : chan

  console.debug(`MIDI note off - note:${note}, velo:${velo}, channel:${channel}`)
  midiOut.send([0x80 + (channel - 1), note, velo])
}
