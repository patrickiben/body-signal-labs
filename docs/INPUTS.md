# Inputs

| Page | What it reads |
|---|---|
| Autonomic Telemetry | Heart, pulse, breath and brain signals through its Mac bridge, or a labeled synthetic demo. See [its own guide](https://github.com/patrickiben/autonomic-telemetry/blob/main/docs/BRIDGE.md) |
| Endless Cockpit | Your cadence: a Bluetooth cadence sensor or smart trainer, the pedal button or Space, or a steady setting |
| Biofeedback Path Cockpit | Heart rate from a Bluetooth strap, cadence from a sensor/trainer/manual controls, or optional Muse S EEG drive in Ride |

## Cadence

Both cockpits read the standard Bluetooth Cycling Speed and Cadence profile, or a smart trainer's Fitness Machine indoor bike data, through Web Bluetooth. They need no other software. Some sensors send nothing until the crank turns.

## Heart rate

Biofeedback Path Cockpit reads the standard Bluetooth Heart Rate profile. A strap that reports beat intervals adds RMSSD and SDNN; a rate-only sensor gives an explicitly limited estimate. [Biofeedback Path Cockpit](BIOFEEDBACK.md) has the details.

## Muse S brainwave drive

The optional [Mac bridge launcher](EEG_SETUP.md) reuses Autonomic Telemetry’s Muse Classic/Athena transport and EEG feature extraction. The cockpit receives EEG beta/alpha balance and signal-quality information from that local bridge. It does not require Hume, a heart strap or cadence. Choose Brainwaves in Ride, explicitly connect the Muse, then calibrate with eyes open. The static hosted page offers a labeled preview; actual Muse input requires the local launcher.

## Browsers

| Browser | Web Bluetooth | Source |
|---|---|---|
| Chrome | Yes, on a computer, after you choose the device in the browser's list | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API), [caniuse](https://caniuse.com/web-bluetooth) |
| Edge | Yes | [caniuse](https://caniuse.com/web-bluetooth) |
| Firefox | No | [caniuse](https://caniuse.com/web-bluetooth) |
| Safari | No | [caniuse](https://caniuse.com/web-bluetooth) |

Web Bluetooth needs a secure context ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)). GitHub Pages is HTTPS. Only Chrome on macOS has actually been run. The other rows come from the sources above.
