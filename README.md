# Immune Defense

A biological tower defense game played in the bloodstream. Deploy white blood cells along five lanes of arteries to fend off pathogens — but watch out for inflammation!

Built with React, TypeScript, Vite, Tailwind CSS, and HTML5 Canvas.

## Game Preview

| Main Menu | Strategic Defense |
|:---:|:---:|
| ![Main Menu](./screenshots/main_menu.png) | ![Gameplay](./screenshots/gameplay.png) |
| *Dynamic menu with canvas animations* | *Active pathogen defense across 5 lanes* |

| Inflammation Mechanic | How to Play |
|:---:|:---:|
| ![Inflammation](./screenshots/inflammation.png) | ![Instructions](./screenshots/instruction.png) |
| *Strategic trade-offs in inflamed lanes* | *Clear in-game documentation* |

## Quick Start

Requires **Node.js 18+** and **npm** (or pnpm/yarn).

```bash
# Install dependencies
npm install

# Run the development server (opens http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## How to Play

- **Goal:** Stop pathogens from reaching the left edge of the screen.
- **ATP** is your currency. Place **Stem Cells** to generate ATP drops — click them to collect.
- Click a defender card at the bottom, then click a cell on the grid to place it.
- **Inject** Remove a defender to recover half of its ATP cost.
- **Inflammation:** if you place 3+ defenders in a single lane, that lane becomes inflamed. Pathogens slow down inside it, but Stem Cells in inflamed lanes generate ATP at half speed. Plan your placement.
- Survive all 7 waves to win.

## Controls

| Action | Control |
|:--- |:--- |
| **Select Defender** | Click a card in the bottom HUD |
| **Place Defender** | Click an empty grid cell (after selecting a card) |
| **Collect ATP** | Click on falling/floating ATP crystals |
| **Pause Game** |  Click the Menu button |
| **Mute/Unmute** | Managed via the Settings menu |

**Pro-Tip:** You can collect multiple ATP drops at once by clicking near clusters of crystals.

### Defenders

| Cell | Cost | Role |
|------|------|------|
| Stem Cell | 50 | Generates ATP drops |
| Neutrophil | 100 | Shoots antibodies forward |
| Eosinophil | 150 | Devours pathogens up close |
| Basophil | 175 | Releases damaging spore clouds |
| Monocyte | 50 | Squashes the first pathogen in lane (single-use) |
| T Cell | 25 | Buried mine, detonates on contact |
| B Cell | 325 | Fires antibodies in 3 lanes simultaneously |
| Platelets | 125 | Clots the entire lane in fire (single-use) |

### Pathogens

Parasites, Protozoa, Fungi, Prokaryotes, Viruses, and Prions — each with unique HP, speed, and damage.

## Project Structure

```
.
├── index.html
├── package.json
├──package-lock.json
├── tsconfig.json
├── vite.config.ts
├── gitignore
├── public/
│   └── favicon.svg
├── screenshots
    ├──main_menu.png
    ├──gameplay.png
    ├──inflammation.png
    └──instruction.png
└── src/
    ├── main.tsx          # React entry point
    ├── App.tsx           # Root component
    ├── index.css         # Tailwind + theme + animations
    └── game/
        ├── types.ts      # State and entity types
        ├── audio.ts      # Sound effects of the game
        ├── config.ts     # Defender / pathogen stats, wave definitions
        ├── draw.ts       # Canvas rendering for everything
        ├── engine.ts     # Game loop, AI, collisions, inflammation
        └── Game.tsx      # React shell, HUD, defender deck, modals
```

All game logic lives in `src/game/`. Rendering is pure HTML5 Canvas — no game framework.

## License

MIT 