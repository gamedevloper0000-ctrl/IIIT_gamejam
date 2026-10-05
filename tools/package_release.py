"""Assemble only the active game and inspect every archive entry before extracting."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
dest = root / "submission"
modules = ["plot.js", "state.js", "clock.js", "session.js", "jam-ui.js", "grid.js", "office.js", "audio.js", "effects.js", "car.js", "results.js", "style.css", "progression.css", "jam.css"]
files = ["index.html", "game.htm"] + ["src/" + item for item in modules]
files += ["public/assets/images/" + item for item in ["export.png", "tiny-town.png", "tiny-town-license.txt"]]
files += ["public/assets/audio/" + item for item in ["corner-cup.wav", "step-dirt.wav", "coffee-pour-freesound.mp3", "cup-set-down-freesound.mp3"]]
archive_path = dest / "plot-twist-jam.zip"
with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in files:
        if not (root / name).is_file():
            raise FileNotFoundError(name)
        archive.write(root / name, name)
    archive.write(dest / "CONTROLS-AND-CREDITS.md", "CONTROLS-AND-CREDITS.md")
extract = root / "output" / "release-check"
extract.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive_path) as archive:
    assert "index.html" in archive.namelist()
    assert len(archive.infolist()) < 1000
    assert sum(item.file_size for item in archive.infolist()) < 500 * 1024 * 1024
    for item in archive.infolist():
        assert len(item.filename) <= 240 and item.file_size < 200 * 1024 * 1024
        target = (extract / item.filename).resolve()
        assert target.is_relative_to(extract.resolve()), item.filename
    assert archive.testzip() is None
    archive.extractall(extract)
manifest = {"archive": archive_path.name, "files": len(files) + 1, "bytes": archive_path.stat().st_size,
            "sha256": hashlib.sha256(archive_path.read_bytes()).hexdigest(), "entry": "index.html"}
(dest / "release-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps(manifest, indent=2))
