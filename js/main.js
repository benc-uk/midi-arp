// HTML nodes
let inputDeviceSelect = null
let outputDeviceSelect = null
let inputChannelSelect = null
let outputChannelSelect = null
let modeSelect = null
let rangeSelect = null
let clockModeSelect = null
let divSelect = null

let tempoSlider = null
let notesDiv = null

// MIDI devices
let inputDevice = null
let outputDevice = null

// Core
let ticks = 0
let step = 0

// Other shit
import ClockTicker from './clock-ticker.js'
let tempo = 120
let internalClock = null

// MIDI input and output
let heldNotes = []
let heldNotesSorted = []

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
  divSelect = document.getElementById('divSel')
  rangeSelect = document.getElementById('rangeSel')
  clockModeSelect = document.getElementById('clockModeSel')
  clockModeSelect.addEventListener('change', initalizeArp)

  tempoSlider = document.getElementById('tempoSlider')
  notesDiv = document.getElementById('inputNotes')

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

  // !!! TEST HARNESS CODE !!!
  // inputDevice = WebMidi.inputs[0]
  // outputDevice = WebMidi.outputs[0]
  // startArp()
}

function deviceSelected(evt) {
  if (!evt.target.value) return

  if (evt.target.id == 'inputDeviceSel') inputDevice = WebMidi.getInputById(evt.target.value)
  if (evt.target.id == 'outputDeviceSel') outputDevice = WebMidi.getOutputById(evt.target.value)

  if (inputDevice && outputDevice) {
    initalizeArp()
  }
}

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
  tempoSlider.disabled = true

  inputDevice.addListener('noteon', inputChannelSelect.value, (e) => {
    addNote(e.note)
  })

  inputDevice.addListener('noteoff', inputChannelSelect.value, (e) => {
    removeNote(e.note)
  })

  if (clockMode == 'CLOCK_EXTERNAL') {
    console.log('EXTERNAL CLOCK')
    inputDevice.addListener('clock', 'all', handleTick)
  }

  if (clockMode == 'CLOCK_INTERNAL' || clockMode == 'CLOCK_INTERNAL_SEND') {
    tempoSlider.disabled = false
    console.log('CLOCK_INTERNAL')
    internalClock = new ClockTicker(tempo)
    internalClock.addEventListener('tick', handleTick)
  }
}

function addNote(note) {
  heldNotes.push(note)
  heldNotesSorted.push(note)
  heldNotesSorted.sort((a, b) => a.number - b.number)
  console.log(JSON.stringify(heldNotesSorted))

  var e = document.createElement('div')
  e.innerHTML = `${note.name}${note.octave}`
  e.className = 'note'
  e.id = `note_${note.number}`
  notesDiv.appendChild(e)
}

function removeNote(note) {
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
  console.log(JSON.stringify(heldNotesSorted))
}

// The whole arp logic is here, called on every MIDI clock tick
function handleTick() {
  ticks++
  let interval = divSelect.value
  let mode = modeSelect.value

  if (clockModeSelect.value == 'CLOCK_INTERNAL_SEND') {
    outputDevice.sendClock()
  }

  if (ticks >= interval) {
    ticks = 0
    if (mode == 'UP' || mode == 'PLAYED') {
      step++
      if (step >= heldNotes.length) {
        step = 0
      }
    }
    if (mode == 'DOWN') {
      step--
      if (step < 0) {
        step = heldNotes.length - 1
      }
    }
    if (mode == 'RANDOM') {
      step = Math.floor(Math.random() * heldNotes.length)
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
    console.log(`STEP:${step} = ${note.number}`)
    outputDevice.playNote(note.number, outputChannelSelect.value, { velocity: 0.7, duration: 50 })
  }
}
