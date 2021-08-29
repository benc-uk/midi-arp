// HTML nodes
let inputDeviceSelect = null
let outputDeviceSelect = null
let inputChannelSelect = null
let outputChannelSelect = null
let modeSelect = null
let rangeSelect = null
let clockModeSelect = null
let divSelect = null
let gateSelect = null
let holdButton = null

let tempoSlider = null
let notesDiv = null

// MIDI devices
let inputDevice = null
let outputDevice = null

// Core
let ticks = 0
let lastStepTime = 0
let step = 0
let direction = 1
let octave = 0
let doubler = 0
let hold = false

// Other shit
import ClockTicker from './clock-ticker.js'
let tempo = 120
let internalClock = null

// MIDI input and output
let heldNotes = []
let heldNotesSorted = []

// map keys to MIDI notes
const keyToNote = {
  z: { number: 36, name: 'C', octave: 2 },
  s: { number: 37, name: 'C#', octave: 2 },
  x: { number: 38, name: 'D', octave: 2 },
  d: { number: 39, name: 'D#', octave: 2 },
  c: { number: 40, name: 'E', octave: 2 },
  v: { number: 41, name: 'F', octave: 2 },
  g: { number: 42, name: 'F#', octave: 2 },
  b: { number: 43, name: 'G', octave: 2 },
  h: { number: 44, name: 'G#', octave: 2 },
  n: { number: 45, name: 'A', octave: 2 },
  j: { number: 46, name: 'A#', octave: 2 },
  m: { number: 47, name: 'B', octave: 2 },

  q: { number: 48, name: 'C', octave: 3 },
  2: { number: 49, name: 'C#', octave: 3 },
  w: { number: 50, name: 'D', octave: 3 },
  3: { number: 51, name: 'D#', octave: 3 },
  e: { number: 52, name: 'E', octave: 3 },
  r: { number: 53, name: 'F', octave: 3 },
  5: { number: 54, name: 'F#', octave: 3 },
  t: { number: 55, name: 'G', octave: 3 },
  6: { number: 56, name: 'G#', octave: 3 },
  y: { number: 57, name: 'A', octave: 3 },
  7: { number: 58, name: 'A#', octave: 3 },
  u: { number: 59, name: 'B', octave: 3 }
}

// =============================================================================
// The main entry point is here, after loading the document / page
// =============================================================================
window.addEventListener('load', async () => {
  inputDeviceSelect = document.getElementById('inputDeviceSel')
  inputDeviceSelect.addEventListener('change', deviceSelected)
  outputDeviceSelect = document.getElementById('outputDeviceSel')
  outputDeviceSelect.addEventListener('change', deviceSelected)
  inputChannelSelect = document.getElementById('inputChannelSel')
  inputChannelSelect.addEventListener('change', initalizeArp)
  outputChannelSelect = document.getElementById('outputChannelSel')
  outputChannelSelect.addEventListener('change', initalizeArp)

  modeSelect = document.getElementById('modeSel')
  modeSelect.addEventListener('change', saveState)
  divSelect = document.getElementById('divSel')
  divSelect.addEventListener('change', saveState)
  rangeSelect = document.getElementById('rangeSel')
  rangeSelect.addEventListener('change', saveState)
  gateSelect = document.getElementById('gateSel')
  gateSelect.addEventListener('change', saveState)

  clockModeSelect = document.getElementById('clockModeSel')
  clockModeSelect.addEventListener('change', initalizeArp)

  tempoSlider = document.getElementById('tempoSlider')
  notesDiv = document.getElementById('inputNotes')

  holdButton = document.getElementById('hold')
  holdButton.className = hold ? '' : 'off'
  holdButton.addEventListener('click', () => {
    hold = !hold
    if (!hold) {
      notesDiv.innerHTML = ''
      heldNotes = []
      heldNotesSorted = []
    }
    holdButton.className = hold ? '' : 'off'
  })

  for (let c = 1; c <= 16; c++) {
    let option = document.createElement('option')
    option.innerHTML = c
    option.value = c
    inputChannelSelect.appendChild(option)
    option = document.createElement('option')
    option.innerHTML = c
    option.value = c
    outputChannelSelect.appendChild(option)
  }

  tempoSlider.addEventListener('change', (e) => {
    tempo = tempoSlider.value
    document.getElementById('tempoSliderLabel').innerHTML = `Tempo: ${tempo} BPM`
    initalizeArp()
  })

  document.addEventListener('keydown', (e) => {
    let note = keyToNote[e.key]
    if (note) {
      addNote(note)
    }
  })
  document.addEventListener('keyup', (e) => {
    let note = keyToNote[e.key]
    if (note) {
      removeNote(note)
    }
  })

  WebMidi.enable(function (err) {
    if (err) {
      document.body.innerHTML = `<div style="text-align: center; font-size: 150%">
      <h1 style="color:#ee2222">Failed to get MIDI access</h1><br>This is likely because your browser doesn't support MIDI or permissions were not granted<br><br>Try again using Chrome or Edge</div>`
      return
    } else {
      initialize()
    }
  })
})

// =============================================================================
// Initialize after getting MIDI access
// =============================================================================
function initialize() {
  console.log('### Set up MIDI input and output devices...')

  inputDeviceSelect.innerHTML = `<option value="" disabled selected>-- MIDI input --</option>`
  outputDeviceSelect.innerHTML = `<option value="" disabled selected>-- MIDI output --</option>`

  for (let input of WebMidi.inputs) {
    console.log(`### - ${input.name} ${input.manufacturer}`)
    let option = document.createElement('option')
    option.innerHTML = input.name
    option.value = input.id
    inputDeviceSelect.appendChild(option)
  }

  for (let output of WebMidi.outputs) {
    console.log(`### - ${output.name} ${output.manufacturer}`)
    let option = document.createElement('option')
    option.innerHTML = output.name
    option.value = output.id
    outputDeviceSelect.appendChild(option)
  }

  loadState()
}

// =============================================================================
// Called to select MIDI devices
// =============================================================================
function deviceSelected(evt) {
  if (!evt.target.value) return

  if (evt.target.id == 'inputDeviceSel') inputDevice = WebMidi.getInputById(evt.target.value)
  if (evt.target.id == 'outputDeviceSel') outputDevice = WebMidi.getOutputById(evt.target.value)

  if (inputDevice && outputDevice) {
    initalizeArp()
  }
}

// =============================================================================
// Initialize the arpeggiator
// =============================================================================
function initalizeArp() {
  if (!inputDevice || !outputDevice) return
  let clockMode = clockModeSelect.value

  console.log(`### initalizeArp ${clockMode} ${tempo}`)
  inputDevice.removeListener('clock', 'all')
  inputDevice.removeListener('noteon', 'all')
  inputDevice.removeListener('noteoff', 'all')
  if (internalClock) {
    internalClock.removeEventListener('tick', handleTick)
    internalClock.removeEventListener('tick', handleTick)
  }
  console.log(tempoSlider)
  tempoSlider.disabled = true

  inputDevice.addListener('noteon', inputChannelSelect.value, (e) => {
    addNote(e.note)
  })

  inputDevice.addListener('noteoff', inputChannelSelect.value, (e) => {
    removeNote(e.note)
  })

  if (clockMode == 'CLOCK_EXTERNAL') {
    inputDevice.addListener('clock', 'all', handleTick)
  }

  if (clockMode == 'CLOCK_INTERNAL' || clockMode == 'CLOCK_INTERNAL_SEND') {
    tempoSlider.disabled = false
    internalClock = new ClockTicker(tempo)
    internalClock.addEventListener('tick', handleTick)
  }

  saveState()
}

// =============================================================================
// Add a note to the held notes
// =============================================================================
function addNote(note) {
  // Don't allow duplicates
  if (heldNotes.find((n) => n.number == note.number)) return

  heldNotes.push(note)
  heldNotesSorted.push(note)
  heldNotesSorted.sort((a, b) => a.number - b.number)

  var e = document.createElement('div')
  e.innerHTML = `${note.name}${note.octave}`
  e.className = 'note'
  e.id = `note_${note.number}`
  notesDiv.appendChild(e)
}

// =============================================================================
// Remove a note from the held notes
// =============================================================================
function removeNote(note) {
  if (hold) return

  for (let i = 0; i < heldNotes.length; i++) {
    if (heldNotes[i].number == note.number) {
      heldNotes.splice(i, 1)
      break
    }
  }
  for (let i = 0; i < heldNotesSorted.length; i++) {
    if (heldNotesSorted[i].number == note.number) {
      heldNotesSorted.splice(i, 1)
      break
    }
  }
  try {
    document.getElementById(`note_${note.number}`).remove()
  } catch (e) {}
}

// =============================================================================
// Main arpeggiator logic here processed per tick
// =============================================================================

function handleTick() {
  ticks++
  if (clockModeSelect.value == 'CLOCK_INTERNAL_SEND') {
    outputDevice.sendClock()
  }
  let interval = divSelect.value
  if (ticks < interval) return

  // If we get here we process and play the arp step
  ticks = 0

  let mode = modeSelect.value
  let stepInterval = performance.now() - lastStepTime
  lastStepTime = performance.now()

  let seqLength = heldNotes.length

  if (mode == 'UP' || mode == 'PLAYED' || mode == 'UP2') {
    step++
    if (mode == 'UP2') {
      doubler++
      if (doubler % 2 == 0) {
        step--
        doubler = 0
      }
    }
    if (step >= seqLength) {
      step = 0
      octave++
      if (octave >= parseInt(rangeSelect.value)) {
        octave = 0
      }
    }
  }
  if (mode == 'DOWN' || mode == 'DOWN2') {
    step--
    if (mode == 'DOWN2') {
      doubler++
      if (doubler % 2 == 0) {
        step++
        doubler = 0
      }
    }
    if (step < 0) {
      step = seqLength - 1
      octave++
      if (octave >= parseInt(rangeSelect.value)) {
        octave = 0
      }
    }
  }
  if (mode == 'UP_DOWN_INC' || mode == 'UP_DOWN_EXC') {
    step += direction

    let bottomStep = mode == 'UP_DOWN_INC' ? 0 : 1
    let topStep = mode == 'UP_DOWN_INC' ? seqLength : seqLength - 1
    if (step < bottomStep) {
      step = 0
      direction = 1
    }
    if (step >= topStep) {
      step = seqLength - 1
      direction = -1
      octave++
      if (octave >= parseInt(rangeSelect.value)) {
        octave = 0
      }
    }
  }
  if (mode == 'RANDOM') {
    step = Math.floor(Math.random() * seqLength)
    octave = Math.floor(Math.random() * parseInt(rangeSelect.value)) + 1
  }

  if (heldNotes.length <= 0) return
  if (heldNotesSorted.length <= 0) return

  let note
  if (mode == 'PLAYED') {
    note = heldNotes[step]
  } else {
    note = heldNotesSorted[step]
  }

  if (!note) return

  let noteDiv = document.getElementById(`note_${note.number}`)
  noteDiv.classList.add('on')
  setTimeout(() => {
    noteDiv.classList.remove('on')
  }, stepInterval * 0.9)

  let noteNumber = note.number + octave * 12

  console.log(`STEP:${step}, OCT:${octave} -> ${noteNumber}`)
  outputDevice.playNote(noteNumber, outputChannelSelect.value, { velocity: 1.0, duration: stepInterval * parseFloat(gateSelect.value) })
}

// =============================================================================
// Save app state to local storage
// =============================================================================
function saveState() {
  localStorage.setItem(
    'arp_state',
    JSON.stringify({
      tempo: tempo,
      div: divSelect.value,
      mode: modeSelect.value,
      range: rangeSelect.value,
      gate: gateSelect.value,
      clockMode: clockModeSelect.value,
      inputDevice: inputDeviceSelect.value,
      outputDevice: outputDeviceSelect.value,
      inputChannel: inputChannelSelect.value,
      outputChannel: outputChannelSelect.value
    })
  )
}

// =============================================================================
// Restore app state from local storage
// =============================================================================
function loadState() {
  let state = JSON.parse(localStorage.getItem('arp_state'))
  if (state) {
    tempo = state.tempo
    tempoSlider.value = tempo
    document.getElementById('tempoSliderLabel').innerHTML = `Tempo: ${tempo} BPM`
    divSelect.value = state.div
    modeSelect.value = state.mode
    rangeSelect.value = state.range
    gateSelect.value = state.gate
    clockModeSelect.value = state.clockMode
    inputDeviceSelect.value = state.inputDevice
    outputDeviceSelect.value = state.outputDevice
    inputChannelSelect.value = state.inputChannel
    outputChannelSelect.value = state.outputChannel

    inputDevice = WebMidi.getInputById(state.inputDevice)
    outputDevice = WebMidi.getOutputById(state.outputDevice)

    initalizeArp()
  }
}
