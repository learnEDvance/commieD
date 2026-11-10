# commieD — Game Idea

## 1. Main requirements

- A browser-based multiplayer maze shooter.
- The long-term scale goal is thousands of concurrent players across 200 cities worldwide.
- The goal of a match is to be the last team standing.
- The game uses a minimal visual style and a communist theme.
- Players are divided evenly among teams.
- Each team shares its ammunition, dash reserve, and health pool.
- When a team's health reaches zero, the team is downed. Half of the players who were alive before the wipe are selected for revival; the others return as ghosts. The team chooses who is revived.
- Ghosts gather resources for their team. A team is eliminated when it has only one living player remaining.

## 2. Match and controls

- A match takes place in a bounded, procedurally generated, top-down maze.
- Each team starts in a large, protected spawn area. Enemies cannot enter another team's spawn area, and players are protected from spawn vulnerability there.
- The interface contains a minimap at the upper left, connection and performance stats at the top, shared team reserves at the lower left, team health at the lower center, and teammate status at the upper right.
- The minimap can show the whole maze or a selectable list of teammates. Press X to switch views.
- Move with WASD or the arrow keys. Hold Shift while moving to dash. Aim and fire with the mouse; holding the mouse button fires continuously. Press Space to use the team's special item.
- Ghosts can switch between the clicker, ammunition, and dash tasks with keys 1, 2, and 3.

## 3. Special items

- Special items appear as collectibles in the maze.
- A team can hold one active effect at a time. Collected items are queued for the team, and any teammate can activate the current item with Space.
- Effects apply to the whole team. The next queued item becomes current when the active effect ends.
- Items spawn on free maze tiles outside team spawn areas.

## 4. Maze generation

- The maze uses a fixed-size, row-major tile array with wall and free-space tiles.
- Generation runs in three passes: place team spawn areas, generate the maze, then place special items.
- Each player occupies one tile. A team's spawn area provides two tiles per player and is shaped as close to a square as possible.

## 5. Ghost resource games

Ghosts contribute resources through self-contained minigames. The host game owns the match loop and shared team state; minigames return resource contributions to the team.

### Soul Contribution

- Ghosts click the central soul to contribute HP to their teammates.
- Click rate is measured over a rolling 10-second window. At 5 clicks per second, the ghost generates 1 HP per second; below 5, the team's HP drains by 0.2 HP per second.
- Generated HP is banked without a cap and used when living teammates need it.
- The HP bar is red below 100 HP per living teammate, yellow for the next 90 HP, and green above that.
- A random shape appears every 10–30 seconds. Clicking it grants 5 HP.
- Press Q to pause or resume.

### Bullet Press

- Follow a 10-letter A–Z sequence to fill a magazine. Correct inputs fill green slots; wrong inputs fill red slots and break the magazine.
- A broken magazine stays in the line until all slots are filled, then produces nothing.
- A perfect magazine produces a whole-number multiplier from 1× to 5× based on average typing speed: at most 400 ms per key gives 5×; 600 ms gives 4×; 800 ms gives 3×; 1,100 ms gives 2×; slower gives 1×.
- Completed magazines move along the conveyor and the next magazine enters the line.
- Production is returned to the host as whole magazines.
- The timer starts with the first keypress. Press Q to pause or resume.

### Dash Supplement Factory

- Ghosts move empty batches through twelve numbered processes across six reusable stations. Each station holds four batches.
- A batch must visit the station assigned to its current process. Wrong-station drops are rejected.
- Work happens automatically. Once a process completes, its ready timer starts; a batch left too long becomes waste and must be manually moved to disposal.
- After process 12, the bottler accepts the batch. Bottling is sequential and takes 10 seconds per batch.
- A finished batch contributes 20 seconds of dash to the team's shared reserve.

## 6. Project scope

The global city-scale multiplayer system, authoritative networking, and lobby are future work. The current main-game prototype and minigames are local modules and do not yet provide that large-scale service.
