/**
 * test.ts — local demo / hardware bring-up for the makebit extension.
 *
 * Compiled only when this repo is opened directly as a project (it is listed under
 * "testFiles" in pxt.json), and ignored when the extension is consumed as a
 * dependency. Open the serial console ("Show console Device" or `pxt console`)
 * to follow the logs.
 *
 * Wiring: PCA9685 motor/servo driver + TM1650 4-digit display on I2C (P19/P20);
 * RGB neopixel strip (4 px) on P16. Put the wheels off the ground before pressing A.
 */

const palette = [
    NeoPixelColors.Red,
    NeoPixelColors.Green,
    NeoPixelColors.Blue,
    NeoPixelColors.White,
]

serial.redirectToUSB()
serial.writeLine("makebit demo: starting")

// 4-digit display: enable + medium brightness, then blank it.
TM1650.on()
TM1650.setIntensity(5)
TM1650.clear()

// RGB strip: dim it so it is comfortable to look at, show red as a "ready" cue.
const strip = makerobo.rgb()
strip.setBrightness(40)
strip.showColor(neopixel.colors(NeoPixelColors.Red))

let counter = 0

// Button A: ramp both drive motors from full reverse to full forward and stop.
// Logs each speed step so you can confirm the PCA9685 writes over serial.
input.onButtonPressed(Button.A, function () {
    serial.writeLine("A: motor sweep")
    for (let speed = -255; speed <= 255; speed += 51) {
        makerobo.MotorRunDual(makerobo.Motors.Left, speed, makerobo.Motors.Right, speed)
        serial.writeValue("speed", speed)
        basic.pause(200)
    }
    makerobo.MotorStopAll()
    serial.writeLine("A: motors stopped")
})

// Main loop: tick a counter onto the display + serial, and rotate the RGB color.
basic.forever(function () {
    TM1650.showNumber(counter)
    strip.showColor(neopixel.colors(palette[counter % palette.length]))
    serial.writeValue("counter", counter)
    counter = (counter + 1) % 10000
    basic.pause(500)
})
