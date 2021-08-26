import * as midi from './midi.js'
import Ticker from './clock/tick.js'

let inputDeviceSelect = null
let outputDeviceSelect = null
let inputDevice = null
let outputDevice = null
let clockDisplay = null
let running = false

let heldNotes = []
let audioContext = null

// =============================================================================
// The main entry point is here, after loading the document / page
// =============================================================================
window.addEventListener('load', async () => {
  inputDeviceSelect = document.getElementById('inputDeviceSel')
  inputDeviceSelect.addEventListener('change', deviceSelected)
  outputDeviceSelect = document.getElementById('outputDeviceSel')
  outputDeviceSelect.addEventListener('change', deviceSelected)

  clockDisplay = document.getElementById('clock')
  clockDisplay.innerHTML = `⌚ Clock: None detected`

  await midi.getAccess(setupDevices)
  if (!midi.access) {
    document.body.innerHTML = `<div style="text-align: center; font-size: 150%">
    <h1 style="color:#ee2222">Failed to get MIDI access</h1><br>This is likely because your browser doesn't support MIDI or permissions were not granted<br><br>Try again using Chrome or Edge</div>`
    return
  }

  // let t = new Ticker(null)
  // t.addEventListener('tick', (e) => {
  //   console.log('Instance fired "something".', e)
  // })

  setupDevices()
})

function setupDevices(evt) {
  //if (evt && evt.type == 'statechange') return
  console.log('### Set up MIDI input and output devices...')

  inputDeviceSelect.innerHTML = `<option value="" disabled selected>-- MIDI input --</option>`
  outputDeviceSelect.innerHTML = `<option value="" disabled selected>-- MIDI output --</option>`
  for (let input of midi.access.inputs.values()) {
    console.log(`### - ${input.name} ${input.manufacturer}`)
    let option = document.createElement('option')
    option.innerHTML = input.name
    option.value = input.id
    inputDeviceSelect.appendChild(option)
  }
  for (let output of midi.access.outputs.values()) {
    console.log(`### - ${output.name} ${output.manufacturer}`)
    let option = document.createElement('option')
    option.innerHTML = output.name
    option.value = output.id
    outputDeviceSelect.appendChild(option)
  }
}

function startListening() {
  if (!(inputDevice && outputDevice)) return

  midi.sendNoteOn(outputDevice, 80, 2, 127)
  // setInterval(() => {
  //   midi.sendNoteOff(outputDevice, 80, 2)
  // }, 200)

  running = true
  midi.resetClock()
  midi.addBPMListener((bpm) => {
    clockDisplay.innerHTML = `⌚ Clock: ${bpm} BPM`
  })
  inputDevice.addEventListener('midimessage', messageListener)
}

function deviceSelected(evt) {
  if (!evt.target.value) return

  if (evt.target.id == 'inputDeviceSel') inputDevice = midi.access.inputs.get(evt.target.value)
  if (evt.target.id == 'outputDeviceSel') outputDevice = midi.access.outputs.get(evt.target.value)

  if (inputDevice && outputDevice) {
    startListening()
  }
}

function messageListener(msg) {
  if (msg.data[0] == 248) {
    //console.log('### - MIDI Clock')
    return
  }

  let status = byteToNibbles(msg.data[0])

  let cmd = status[0]
  let channel = status[1]
  console.log(`### - MIDI ${cmd} on channel ${channel}`)
}

export function byteToNibbles(byte) {
  const high = byte & 0xf
  const low = byte >> 4
  return [low, high]
}
