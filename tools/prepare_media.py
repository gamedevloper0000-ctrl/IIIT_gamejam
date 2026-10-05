"""Copy real gameplay captures and encode their twist sequence as a GIF."""
from pathlib import Path
import shutil
from PIL import Image

root = Path(__file__).resolve().parents[1]
source, target = root / "output/playwright", root / "submission"
for filename in ["01-coffee.png", "02-twist-preview.png", "03-homecoming.png"]:
    shutil.copy2(source / filename, target / filename)
paths = sorted(source.glob("twist-[0-9][0-9].png"))
frames = [Image.open(path).convert("RGB").resize((864, 600), Image.Resampling.NEAREST) for path in paths]
durations = [max(40, min(300, round((paths[i + 1].stat().st_mtime - path.stat().st_mtime) * 1000))) if i + 1 < len(paths) else 1100 for i, path in enumerate(paths)]
frames[0].save(target / "plot-twist.gif", save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=True)
print(f"Three screenshots copied; {len(frames)} actual gameplay frames encoded as plot-twist.gif")
