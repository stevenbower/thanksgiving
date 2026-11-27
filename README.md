# Turkey Day Takedown 🦃

A 3/4-view Thanksgiving arena shooter starring the family. Battle turkeys, potato monsters, corn soldiers,
cranberry blobs, pumpkin brutes and a boss every 5 levels, solo or with the whole family on their own devices.

## Playing together
Tap **MULTIPLAYER**, enter your name and **HOST A GAME** to get a 4-letter code (or share the invite link).
Others join with the code, everyone picks a different character in the lobby, and the host starts.
Enemies, bosses and rewards scale up with the number of players. Fallen players get back up at the end of each level.

## Controls
- **Desktop:** WASD move · mouse aim · click fire · Space stuffing bomb · Shift / right-click dash · Q/E or 1–4 swap weapons · F special · T auto-aim · R auto-fire · Esc menu · M mute
- **Phone:** left thumb moves · right thumb (or FIRE) shoots · buttons for special, bomb, dash and swap · AIM/FIRE toggles up top

## How it's built
- `public/game.js` + `public/assets/`: the game itself (plain canvas JS, no framework). Art was generated with OpenAI `gpt-image-2`.
- `src/net.js`: multiplayer. The host's device runs the game; other devices send inputs and draw the host's snapshots
  (predicting their own movement). Devices connect directly over WebRTC and fall back to relaying through AppSync.
- `amplify/`: AWS Amplify Gen 2 backend: guest Cognito identities, DynamoDB tables for game codes (auto-expiring)
  and high scores, and an AppSync real-time channel for the lobby, WebRTC signalling and relay.
- Hosted on AWS Amplify; every push to `main` deploys the site and backend (`amplify.yml`).

## Local development
```
npm install --include=dev
npm run dev                         # http://localhost:5173 (single player)
open several tabs with ?net=local   # multiplayer between tabs, no AWS needed
npx ampx sandbox                    # your own cloud backend (writes amplify_outputs.json)
```
Dev URL flags: `?wave=N` start level · `?debug` exposes `window.__tg` · `?relay` forces the relay path.
