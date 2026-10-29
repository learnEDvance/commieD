# co-up — Hybrid Team & Support System
*Alternative Design Concept — Under Consideration*

## 1. Concept

This version of co-up combines individual survival with collective protection.

Every player has 50 HP of personal health, while additional HP belongs to the team and is shared among its members. When a player takes damage, the damage affects the team-shared HP and the player's own HP equally, until the player's personal HP reaches 50. Beyond that threshold, further damage affects only the player.

Players outside active combat can participate as support allies, helping active players find resources and establish connections.

## 2. Hybrid Health System

The health system has two components:

- **Personal HP:** Every player has a personal reserve of 50 HP.
- **Team HP:** Additional health is shared among the members of a team.

### Damage Rules

- Damage is applied to the player who is hit.
- The player's HP decreases, and the HP of every teammate decreases by the same amount.
- This shared damage continues until the affected player's personal HP reaches 50.
- Once the player reaches 50 personal HP, subsequent damage affects only that player and no longer reduces their teammates' HP through the shared-damage mechanic.
- The personal 50 HP reserve belongs exclusively to the individual player.

The exact starting team HP, regeneration rules, and treatment of team HP when players are eliminated remain to be defined.

## 3. Support Allies

Players who are not actively participating in combat can take on the role of support allies.

Support allies can:

- Search for useful resources.
- Establish connections with active players.
- Help connected players obtain resources through the game's connection system.
- Influence active gameplay without directly fighting.

Support allies are intended to be active participants rather than passive spectators.

## 4. Player Roles

### Active Players

- Explore the maze.
- Fight other players.
- Collect resources.
- Manage their personal HP and survival.
- Benefit from shared team HP and support allies.

### Support Allies

- Search for resources.
- Connect with active players.
- Assist with resource availability.
- Help influence match outcomes through support.

The precise restrictions and capabilities of each role remain undecided.

## 5. Intended Experience

The system combines individual combat with collective interdependence.

Damage to one player can weaken the entire team, making each encounter a collective concern. However, the personal 50 HP reserve ensures that players retain an individual health component that teammates cannot lose on their behalf.

Support allies extend participation beyond active combat, giving people at an offline event a way to influence the match even when they are not directly fighting.

## 6. Unresolved Decisions

- Starting and maximum team HP.
- Team HP regeneration and replenishment.
- Whether team HP is shared equally or represented as a single pool.
- How team HP behaves when a player dies or disconnects.
- How support allies find, transport, and deliver resources.
- Whether support allies can assist multiple players.
- How connections and support relationships are established and maintained.
- How the system balances support and combat advantages.

## 7. Design Principle

co-up combines individual survival with collective consequences.

Every player retains 50 HP that belongs exclusively to them, while the team's shared HP makes damage consequential for everyone. Support allies add another layer of participation, allowing people outside active combat to influence the outcome of an offline match.