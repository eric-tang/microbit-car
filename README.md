# makebit

MakeCode extension for the **clb (Chuanglebo) Robot micro:bit** expansion board.

It drives the on-board PCA9685 controller and gives you blocks for:

- **Motors** – run / stop the DC drive motors (speed `-255…255`)
- **Servos** – standard and "Geek" servos on channels `S1`–`S6`
- **RGB pixels** – the 4 on-board NeoPixels (pin `P16`)
- **Sensors** – infrared obstacle, flame, and ultrasonic distance
- **Sound-sensor level** – set a servo channel high/low

Builds a universal hex, so it runs on micro:bit **V1 and V2**.

## Writing your car program in Python

This is a normal MakeCode extension, so it works in **Blocks, JavaScript, and
Python** with no extra work on your part. To use Python:

1. Open <https://makecode.microbit.org> and create a project.
2. **Extensions** → add this repo's URL (e.g. `github:<you>/microbit-car`).
3. Flip the language toggle at the top of the editor from **Blocks/JavaScript** to **Python**.

MakeCode generates the Python names from the TypeScript ones by converting them
to `snake_case` (e.g. `MotorRun` → `motor_run`). The snippets below match what
you'll see. You don't write any `import` lines — `makerobo`, `basic`, `pins`,
`neopixel`, etc. are already available.

### Drive the car

```python
# Forward at speed 150 (range -255..255) for 1 second, then stop
makerobo.motor_run_dual(makerobo.Motors.Left, 150, makerobo.Motors.Right, 150)
basic.pause(1000)
makerobo.motor_stop_all()

# One motor at a time, or run-then-auto-stop after N seconds
makerobo.motor_run(makerobo.Motors.Left, 200)
makerobo.motor_run_delay(makerobo.Motors.Right, 200, 2)   # stops itself after 2 s
makerobo.motor_stop(makerobo.Motors.Left)
```

### Steer with a servo

```python
makerobo.servo(makerobo.Servos.S1, 90)         # standard servo, 0..180 degrees
makerobo.geek_servo(makerobo.Servos.S2, 90)    # "Geek" servo, -45..225 degrees
```

### Read sensors

```python
# Ultrasonic distance on the echo pin
cm = makerobo.ping(DigitalPin.P1, makerobo.PingUnit.Centimeters)
basic.show_number(cm)

# Infrared obstacle sensor: True when the chosen state is seen
if makerobo.ir(DigitalPin.P2, makerobo.enObstacle.Obstacle):
    basic.show_string("STOP")

# Flame sensor
if makerobo.flame(DigitalPin.P8, makerobo.enflame.Flame):
    basic.show_string("FIRE")
```

### RGB pixels

```python
strip = makerobo.rgb()
strip.set_brightness(40)
strip.show_color(neopixel.colors(NeoPixelColors.Blue))
```

### Put it together — drive until something is in the way

```python
def on_forever():
    if makerobo.ping(DigitalPin.P1, makerobo.PingUnit.Centimeters) < 15:
        makerobo.motor_stop_all()
    else:
        makerobo.motor_run_dual(makerobo.Motors.Left, 120, makerobo.Motors.Right, 120)
basic.forever(on_forever)
```

> **Source of truth:** if a name in your editor ever differs from a snippet here,
> trust the editor — its Python view is generated directly from the extension.

## Block ↔ Python reference

| Block label | Python call |
|---|---|
| `motor \| speed` | `makerobo.motor_run(Motors.Left, 150)` |
| `motor \| speed \| … (dual)` | `makerobo.motor_run_dual(Motors.Left, 150, Motors.Right, 150)` |
| `motor \| speed \| delay s` | `makerobo.motor_run_delay(Motors.Left, 150, 1)` |
| `stop motor` | `makerobo.motor_stop(Motors.Left)` |
| `stop all motors` | `makerobo.motor_stop_all()` |
| `servo \| angle` | `makerobo.servo(Servos.S1, 90)` |
| `Geek Servo \| angle` | `makerobo.geek_servo(Servos.S1, 90)` |
| `set sound sensor \| level` | `makerobo.set_level(Servos.S3, True)` |
| `infrared obstacle sensor` | `makerobo.ir(DigitalPin.P2, enObstacle.Obstacle)` |
| `flame sensor` | `makerobo.flame(DigitalPin.P8, enflame.Flame)` |
| `ultrasonic module` | `makerobo.ping(DigitalPin.P1, PingUnit.Centimeters)` |
| `RGB` | `makerobo.rgb()` |

*(`makerobo` is the block category, shown as **makerobo** in the editor toolbox.)*

See [`DEVELOPMENT.md`](DEVELOPMENT.md) for building, flashing, and debugging.
