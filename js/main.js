// HTML nodes
let inputDeviceSelect = null
let outputDeviceSelect = null
let tempoSlider = null
let notesDiv = null

// MIDI devices
let inputDevice = null
let outputDevice = null

// Core
let ticks = 0
let steps = 0

// Other shit
import ClockTicker from './clock-ticker.js'
let tempo = 120
let CLOCK_EXTERNAL = 0
let CLOCK_INTERNAL = 1
let CLOCK_INTERNAL_SEND = 2
let clockMode = CLOCK_EXTERNAL
let internalClock = null

// MIDI input and output
let inputChannel = 3
let outputChannel = 2
let heldNotes = []

// =============================================================================
// The main entry point is here, after loading the document / page
// =============================================================================
window.addEventListener('load', async () => {
  inputDeviceSelect = document.getElementById('inputDeviceSel')
  inputDeviceSelect.addEventListener('change', deviceSelected)
  outputDeviceSelect = document.getElementById('outputDeviceSel')
  outputDeviceSelect.addEventListener('change', deviceSelected)
  tempoSlider = document.getElementById('tempoSlider')
  notesDiv = document.getElementById('inputNotes')

  tempoSlider.addEventListener('change', (e) => {
    tempo = tempoSlider.value
    document.getElementById('tempoSliderLabel').innerHTML = `${tempo} BPM`
    startArp()
  })

  document.getElementById('modeSel').addEventListener('change', (e) => {
    clockMode = e.target.value
    console.log(`clockMode: ${clockMode}`)
    startArp()
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
  inputDevice = WebMidi.inputs[0]
  outputDevice = WebMidi.outputs[0]
  startArp()
}

function deviceSelected(evt) {
  if (!evt.target.value) return

  if (evt.target.id == 'inputDeviceSel') inputDevice = WebMidi.getInputById(evt.target.value)
  if (evt.target.id == 'outputDeviceSel') outputDevice = WebMidi.getOutputById(evt.target.value)

  if (inputDevice && outputDevice) {
    startArp()
  }
}

function startArp() {
  heldNotes = []
  console.log(`###----- startArp ${clockMode}`)
  inputDevice.removeListener('clock', 'all')
  inputDevice.removeListener('noteon', 'all')
  inputDevice.removeListener('noteoff', 'all')
  if (internalClock) {
    internalClock.removeEventListener('tick', handleTick)
    internalClock.removeEventListener('tick', handleTick)
  }
  tempoSlider.style.display = 'none'

  inputDevice.addListener('noteon', inputChannel, (e) => {
    addNote(e.note)
  })

  inputDevice.addListener('noteoff', inputChannel, (e) => {
    removeNote(e.note)
  })

  if (clockMode == CLOCK_EXTERNAL) {
    console.log('EXTERNAL CLOCK')
    inputDevice.addListener('clock', 'all', handleTick)
  }

  if (clockMode == CLOCK_INTERNAL || clockMode == CLOCK_INTERNAL_SEND) {
    console.log('CLOCK_INTERNAL')
    tempoSlider.style.display = 'inline'
    document.getElementById('tempoSliderLabel').innerHTML = `${tempo} BPM`
    internalClock = new ClockTicker(tempo)
    internalClock.addEventListener('tick', handleTick)
  }
}

function addNote(note) {
  heldNotes.push(note)
  var e = document.createElement('h2')
  e.innerHTML = `${note.name}${note.octave}`
  e.style.color = '#338833'
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
  document.getElementById(`note_${note.number}`).remove()
}

// The whole arp logic is here, called on every MIDI clock tick
function handleTick() {
  ticks++
  let interval = 12

  if (clockMode == CLOCK_INTERNAL_SEND) {
    outputDevice.sendClock()
  }

  if (ticks >= interval) {
    ticks = 0
    steps++

    if (heldNotes.length <= 0) return
    let noteIndex = steps % heldNotes.length
    let note = heldNotes[noteIndex]
    if (!note) return
    outputDevice.playNote(note.number, outputChannel, { velocity: 0.7, duration: 50 })
  }
}
