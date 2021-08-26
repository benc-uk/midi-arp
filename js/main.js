// HTML nodes
let inputDeviceSelect = null
let outputDeviceSelect = null
let tempoSlider = null

// MIDI devices
let inputDevice = null
let outputDevice = null

// Other shit
import ClockTicker from './clock-ticker.js'
let ticks = 0
let tempo = 120
let CLOCK_EXTERNAL = 0
let CLOCK_INTERNAL = 1
let CLOCK_INTERNAL_SEND = 2
let clockMode = CLOCK_EXTERNAL
let internalClock = null

// MIDI input
let inputChannel = 3
let outputChannel = 2
let heldNotes = {}

// =============================================================================
// The main entry point is here, after loading the document / page
// =============================================================================
window.addEventListener('load', async () => {
  inputDeviceSelect = document.getElementById('inputDeviceSel')
  inputDeviceSelect.addEventListener('change', deviceSelected)
  outputDeviceSelect = document.getElementById('outputDeviceSel')
  outputDeviceSelect.addEventListener('change', deviceSelected)
  tempoSlider = document.getElementById('tempoSlider')

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
  console.log(`###----- startArp ${clockMode}`)
  inputDevice.removeListener('clock', 'all')
  if (internalClock) {
    internalClock.removeEventListener('tick', handleTick)
    internalClock.removeEventListener('tick', handleTick)
  }
  tempoSlider.style.display = 'none'

  inputDevice.addListener('noteon', inputChannel, (e) => {
    console.log(`noteon ${e.note} ${e.velocity}`)
    heldNotes[e.note.number] = e.note
    console.log(`heldNotes: ${JSON.stringify(heldNotes)}`)
  })

  inputDevice.addListener('noteoff', inputChannel, (e) => {
    console.log(`noteoff ${e.note} ${e.velocity}`)
    delete heldNotes[e.note.number]
    console.log(`heldNotes: ${JSON.stringify(heldNotes)}`)
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

function handleTick() {
  ticks++
  let interval = 12

  if (clockMode == CLOCK_INTERNAL_SEND) {
    outputDevice.sendClock()
  }

  if (ticks >= interval) {
    ticks = 0
    for (let noteIndex in heldNotes) {
      let note = heldNotes[noteIndex]
      console.log(note)
      outputDevice.playNote(note.number, outputChannel, { velocity: 1.0, duration: 50 })
    }
  }
}
