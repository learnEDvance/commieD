# co-up

## Game Concept Document — Current Understanding

### 1. Basic Concept

co-up is a multiplayer shooting game set in a maze.

The game is designed around a large number of players, potentially 200, who share the same game world.

Its defining mechanic is a network of connections between players. These connections determine team membership and enable resource sharing.

The connections between players are not visible to other players.

### 2. The Maze and Players

- Players move around inside a maze.
- Players can encounter other players while exploring.
- Players can attack and kill other players.
- Players can find resources and use them to survive and fight (resources are small rainbow triangles strewn around the maze; touching them gives a random item).
- Players may be alone or belong to a connected group.

### 3. Connecting Players

- Two players who are not part of a team can touch each other to establish a connection.
- Connected players belong to the same team.
- Teams are groups of players connected through the network.
- A player who already belongs to a team cannot join another team.
- A single, unconnected player can be added to an existing group by establishing a connection with them.
- Connections between players form the underlying social network of the game.
- Other players cannot see these connections.
- A player can have a maximum of 3 connections.

### 4. Combat

- Players can shoot and kill other players.
- An unconnected player can be attacked and killed.
- Killing another player can yield resources (random drop), same effect as collecting a rainbow triangle.
- Players who belong to teams cannot join other teams.

#### Movement
- Move with WASD or arrow keys.
- Dash with Shift (dash speed is a multiplier of normal movement speed).
- Movement speed is to be tuned as development goes.

#### Shooting & Damage
- Point and click to shoot.
- Hold to shoot: 10 ammo per second.
- Damage per bullet: 2 HP.
- Range is infinite as long as the target is in direct line of sight.
- Use Space to use a special item.

#### Player Death
- When a player dies, they are out of the current game (not respawned).
- When a player dies, the killer receives a random drop from the killed player.

### 5. Resources and Treasury System

**Currency: Time**

- Time is the universal currency in co-up.
- Every player earns 1 Time per second just by existing.
- Time is used to regen all resources the player currently has (HP, speed, etc.).
- When all resources for a player are full, extra Time goes to the treasury to expand its resources.
- When it's time to pay up, players send Time to the treasury.
- If the treasury lacks sufficient resources, the player gets nothing.

**Resources:**
- **HP+**: +10 HP. If HP is full, it goes to the treasury.
- **Speed+**: Gives a 15 second speed ability. Speed can only be used for a limited time before requiring regeneration (15 sec speed boost takes 30 seconds to regen). If speed is full, it is added to the treasury.
- **Rounds+**: 3 rounds of extra ammo (each round has 10 bullets). Rounds cannot regenerate - this is the only source for them.
- **Shield**: Special ability that makes the player invulnerable for 10 seconds.
- **Bomb**: Damages enemies and the nearest 5 players linked to the bomb. The enemy takes 80 HP damage; linked players take 40 HP damage.

Resources are collected from small rainbow triangles strewn around the maze (touching gives a random item). Killing a player gives the same effect as collecting a rainbow triangle (random drop).

The treasury is not a central storage location. Instead, resources are distributed among the players in the team and shared through their connections.

#### Withdrawing Resources

- Players do not pay a separate cost when taking resources from the treasury.
- When a player is running low on a resource, they automatically draw from the treasury to replenish it, subject to availability.
- Since the treasury is distributed across players, the resources needed may not be held by the player receiving them directly.
- Resources transferred through indirect connections may take time to arrive.
- The treasury auto-converts Time to resources based on what is depleted.
- If the treasury lacks sufficient resources, the player gets nothing.

#### Regeneration and Repayment

Every resource in co-up takes time to regenerate. This applies to health, ammunition, and any other resources introduced later. Time is earned passively (1/sec) and is the source used to create other resources.

- For each second, 0.4 Time goes to the treasury until the entire debt is repaid; the rest is used by the player to regenerate their resources.
- No extra 5% tax.
- The exact amount of time needed to fulfill resources will be tuned during coding/testing.
- If all resources for the current player are full, extra Time goes to the treasury to expand its resources.

The treasury is distributed across players; resources can be transferred between indirectly connected teammates. Transfers through indirect connections take longer than direct transfers. Each connection introduces a fixed time delay to a resource transfer based on hop count, not physical distance. **Each hop adds 0.2 seconds** (may be tuned during coding/testing). If a resource transfer is in progress and the network path breaks, the resources are lost.

### 6. Team Network and Resource Transfers

A team is a connected group of players.

Connections determine team membership and enable resources to move between players.

- Players do not need to be directly connected to one another to belong to the same team, provided a path of connections links them.
- Resources can be transferred between indirectly connected teammates.
- Transfers through indirect connections take longer than direct transfers.
- Each connection introduces a fixed time delay to a resource transfer.
- The delay is based on the number of connections the transfer must pass through, not the physical length or distance of those connections.
- Each hop adds 0.2 seconds (may be tuned during coding/testing).
- If a resource transfer is in progress and the network path breaks, the resources are lost.
- Players cannot break connections until they die.

### 7. Endgame and Group Division

The end goal of the game is to become the last player standing.

When only one team remains, that team does not simply win. Instead, the team is uniformly divided into separate teams (similar to an amoeba dividing). This process repeats: whenever only one team remains, it is divided again until only one player remains (the last player standing).

- The division produces multiple separate groups/teams.
- The number and sizes of the resulting groups are controlled by a configuration.
- The configuration should allow players to be distributed as evenly as possible (by LCM rule, favouring big teams in the LCM).
- The newly separated groups fight one another.
- When dividing a team because it's the only team on the map, divide the total players into teams of equal number of members (by LCM rule, favouring big teams in the LCM).
- Resources are divided between treasuries based on treasury per head, then added up for that team's treasury.
- Existing connections are broken on division (players cannot break connections until they die; division effectively breaks them). The exact handling details may be refined during implementation.

### 8. Intended Scale

The intended multiplayer scale is approximately 200 players in a shared game.

The game will need multiplayer networking so that players can interact in the same world.

The specific networking technology, server architecture, hosting arrangements, and performance requirements have not yet been chosen.

### 9. Unresolved Decisions

The following details still need to be defined by the designer:

- How the game handles players disconnecting or leaving (team membership, resources, connections). To be decided later.

### 10. Design Principle

The central concept of co-up is a multiplayer maze shooter in which player-created connections form teams, teams share resources through a distributed network, and the surviving team's eventual division creates a new conflict. The goal is to become the last player standing.

Resources are distributed among players rather than held in a central treasury. The network determines how quickly resources can travel. Time is the universal currency (earned 1/sec); it is used to regenerate resources, sent to the treasury when paying up, and the treasury auto-converts Time to depleted resources. If all resources are full, extra Time goes to the treasury.

Visual style is simple circles, lines, and basic shapes (rects, circles, triangles) with simple colors and a minimal UI.

The game should be developed according to the designer's intended vision rather than adding mechanics before they have been decided.