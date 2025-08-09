## Find The Tab (Chrome MV3 Extension)

Quickly find and switch to open tabs or recent history with a floating search box. Toggle with a hotkey and type natural language like "youtube studio dashboard" to get the top 4 matches with favicons.

### Features
- Toggle overlay via keyboard shortcut
- Searches all open windows/tabs and recent history (last 30 days, up to 50 items)
- Ranks by fuzzy-ish scoring; shows top 4 with favicon/title/url
- Arrow key navigation, Enter to activate, Esc to close

### Install (Developer Mode)
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" and choose this folder
4. Optional: Edit the keyboard shortcut at `chrome://extensions/shortcuts`

### Usage
- Default hotkey: Ctrl+Shift+8 (Windows/Linux) / Command+Shift+8 (macOS)
- Type your prompt, arrow up/down to select, press Enter to open/focus
- Click outside or press Esc to close

### Notes
- Some special pages (chrome://, Chrome Web Store) do not allow content scripts; the overlay won’t render there.
- `history` permission is required to search recent pages. Remove it from `manifest.json` if you only want to search tabs.


### Credits
- Note: completely generated with GPT-5 , and a little bit of instructions from me 🙂

### Demo
<video src="./Demo.mp4" controls width="720" preload="metadata"></video>

- Video: [Watch the demo](./Demo.mp4)  
- Screenshot above: place an image at `docs/demo.png` in this repo to render here.

