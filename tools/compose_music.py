"""Render original Corner Cup music with no samples or external dependencies."""
from pathlib import Path
import array
import math
import random
import wave

RATE, BEAT = 22050, 60 / 84
samples = [0.0] * round(RATE * BEAT * 32)
rng = random.Random(2026)

def note(midi, start, length, volume, mellow=False):
    frequency = 440 * 2 ** ((midi - 69) / 12)
    for frame in range(round(length * RATE)):
        t = frame / RATE
        envelope = min(1, t / .014) * min(1, (length - t) / .10) * math.exp(-t * (2.4 if mellow else 4))
        phase = t * frequency * math.tau
        sound = math.sin(phase) + (.10 if mellow else .22) * math.sin(phase * 2) + .045 * math.sin(phase * 3)
        samples[(round(start * RATE) + frame) % len(samples)] += sound * envelope * volume

# Original eight-bar phrase: open sixths, soft bass, a sparse answering melody.
chords = [(48, 55, 59, 64), (48, 57, 62, 64), (45, 52, 55, 60), (45, 52, 59, 62),
          (41, 48, 52, 57), (41, 48, 55, 60), (43, 50, 53, 59), (43, 50, 57, 62)]
melody = [(0, 76), (1.5, 79), (3, 74), (5, 76), (6.5, 81), (8, 79), (10.5, 76),
          (12, 74), (14, 71), (16.5, 72), (18, 76), (19.5, 79), (21, 77), (23, 74),
          (24.5, 71), (26, 74), (28, 69), (29.5, 71), (31, 72)]
for bar, chord in enumerate(chords):
    for offset in (0, 2):
        note(chord[0] - 12, (bar * 4 + offset) * BEAT, BEAT * 1.7, .14, True)
    for i in range(8):
        note(chord[1 + i % 3], (bar * 4 + i * .5) * BEAT, BEAT * .8, .07, True)
for beat, midi in melody:
    note(midi, beat * BEAT, BEAT * 1.3, .085)
for beat in range(64):
    start = round((beat * .5 + (.04 if beat % 2 else 0)) * BEAT * RATE)
    previous = 0
    for j in range(round(.04 * RATE)):
        noise = rng.uniform(-1, 1)
        samples[(start + j) % len(samples)] += (noise - previous) * .007 * math.exp(-j / (RATE * .009))
        previous = noise
dry, delay = samples[:], round(BEAT * .75 * RATE)
for i in range(len(samples)):
    samples[i] += dry[(i - delay) % len(samples)] * .16
peak = max(abs(sample) for sample in samples)
pcm = array.array("h", (round(sample / max(1, peak / .78) * 32767) for sample in samples))
target = Path(__file__).resolve().parents[1] / "public/assets/audio/corner-cup.wav"
with wave.open(str(target), "wb") as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(RATE)
    output.writeframes(pcm.tobytes())
print(f"Original loop: {target.name}, {len(samples) / RATE:.2f}s, {target.stat().st_size} bytes")
