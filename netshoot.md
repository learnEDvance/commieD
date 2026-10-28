# netshoot

## Game Concept Document — Current Understanding

### 1. Basic Concept

netshoot is a multiplayer shooting game set in a maze.

The game is designed around a large number of players, potentially 200, who share the same game world.

Its defining mechanic is a network of connections between players. These connections determine team membership and enable resource sharing.

The connections between players are not visible to other players.

### 2. The Maze and Players

- Players move around inside a maze.
- Players can encounter other players while exploring.
- Players can attack and kill other players.
- Players can find resources and use them to survive and fight.
- Players may be alone or belong to a connected group.

### 3. Connecting Players

- Two players who are not part of a team can touch each other to establish a connection.
- Connected players belong to the same team.
- Teams are groups of players connected through the network.
- A player who already belongs to a team cannot join another team.
- A single, unconnected player can be added to an existing group by establishing a connection with them.
- Connections between players form the underlying social network of the game.
- Other players cannot see these connections.

### 4. Combat

- Players can shoot and kill other players.
- An unconnected player can be attacked and killed.
- Killing another player can yield resources, with the resources obtained being random.
- Players who belong to teams cannot join other teams.

The exact combat rules, weapons, movement mechanics, and conditions for attacking different players have not yet been defined.

### 5. Resources and Treasury System

Each team shares resources through its player network. For now, these resources include:

- Extra health.
- Ammunition.

The treasury is not a central storage location. Instead, resources are distributed among the players in the team and shared through their connections.

#### Contributions

- When players obtain resources, a certain percentage of their contribution goes toward the shared treasury.
- The contribution percentage depends on the resource type and other relevant factors.
- The exact contribution percentages have not yet been defined.

#### Withdrawing Resources

- Players do not pay a separate cost when taking resources from the treasury.
- When a player is running low on a resource, they automatically draw from the treasury to replenish it, subject to availability.
- Since the treasury is distributed across players, the resources needed may not be held by the player receiving them directly.
- Resources transferred through indirect connections may take time to arrive.

#### Regeneration and the Treasury Tax

Every resource in netshoot takes time to regenerate. This applies to health, ammunition, and any other resources introduced later.

When a player draws resources from the treasury, their regeneration rate is temporarily reduced. This reduction represents the treasury taking a portion of the player's regeneration time to generate additional resources for the shared pool.

- A player's normal regeneration rate is reduced while they repay what they owe to the treasury.
- For example, if health normally regenerates at 10 HP/s, it may regenerate at 5 HP/s during repayment.
- The repayment includes the player's outstanding contribution to the treasury, plus a tax equivalent to 5% of the regeneration time required to create the resources they took.
- The 5% tax is based on **time required to regenerate the resource**, not on health or any other specific resource quantity.
- The same principle applies to ammunition and other regenerating resources, making the system consistent across resource types.

Conceptually, the treasury temporarily claims part of a player's time to produce extra resources. Players receive resources when they need them, but repaying the treasury slows their personal regeneration until their outstanding obligation is settled.

This system allows the tax and repayment mechanics to use a common time-based calculation, simplifying backend configuration as new resource types are introduced.

The exact implementation of regeneration rates, repayment scheduling, and the interaction between different resource types remains to be defined.

### 6. Team Network and Resource Transfers

A team is a connected group of players.

Connections determine team membership and enable resources to move between players.

- Players do not need to be directly connected to one another to belong to the same team, provided a path of connections links them.
- Resources can be transferred between indirectly connected teammates.
- Transfers through indirect connections take longer than direct transfers.
- Each connection introduces a fixed time delay to a resource transfer.
- The delay is based on the number of connections the transfer must pass through, not the physical length or distance of those connections.

The exact delay per connection and the rules for transfers when a connection breaks have not yet been defined.

### 7. Endgame and Group Division

When only one team remains, that team does not simply win.

Instead, the team divides into multiple smaller groups, similar to an amoeba dividing.

- The division produces multiple separate groups.
- The number and sizes of the resulting groups are controlled by a configuration.
- The configuration should allow players to be distributed as evenly as possible.
- The newly separated groups fight one another.

The precise division algorithm, treatment of existing connections, and handling of resources during division have not yet been defined.

### 8. Intended Scale

The intended multiplayer scale is approximately 200 players in a shared game.

The game will need multiplayer networking so that players can interact in the same world.

The specific networking technology, server architecture, hosting arrangements, and performance requirements have not yet been chosen.

### 9. Unresolved Decisions

The following details still need to be defined by the designer:

- Exact combat and movement mechanics.
- How players find and collect resources.
- The complete list of resources and how they work.
- Contribution percentages for different resources.
- The exact time-based repayment and tax calculation.
- How repayment works when multiple resource types are involved.
- What happens when the treasury lacks sufficient resources.
- The fixed time delay per connection.
- Whether and how players can break connections.
- What happens to resource transfers if a network path breaks.
- How the game handles players disconnecting or leaving.
- The exact rules for team division.
- How and when the match ultimately ends.
- The visual style and interface.

### 10. Design Principle

The central concept of netshoot is a multiplayer maze shooter in which player-created connections form teams, teams share resources through a distributed network, and the surviving team's eventual division creates a new conflict.

Resources are distributed among players rather than held in a central treasury. The network determines how quickly resources can travel, while the treasury's time-based tax makes shared resources available at the cost of temporarily slower personal regeneration.

The game should be developed according to the designer's intended vision rather than adding mechanics before they have been decided.