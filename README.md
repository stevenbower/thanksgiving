# Turkey Day Takedown 🦃

A 3/4-view Thanksgiving arena shooter starring the family. Battle turkeys, potato monsters, corn soldiers,
cranberry blobs, pumpkin brutes and the boss **Gobblezilla** (every 5th wave) with the Gravy Gun,
Cranberry Blunderbuss, Corn Gatling, Pie Frisbee and Stuffing Bombs.

Pure static site (`index.html` + `game.js` + `assets/`), no build step and no API keys at runtime.
All art was pre-generated with OpenAI `gpt-image-2` from the family photos.

## Controls
- **Desktop:** WASD move · mouse aim · click fire · Space stuffing bomb · Shift / right-click dash · Q/E, 1–4 or wheel swap weapons · Esc pause · M mute
- **Phone:** left thumb moves · right thumb aims & fires (or let it auto-aim/auto-fire) · buttons for bomb, dash and swap

Names on the fighter select screen are editable and saved in the browser.

## Hosting on GitHub Pages
Settings → Pages → Deploy from branch → `main` / root. That's it.

## Dev tips
- `?wave=5` starts at a given wave (5 = boss)
- Run locally with any static server, e.g. `python3 -m http.server`
