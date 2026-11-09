# commieD-Idea

01main requisites
- Multiplayer maze shooter (browser-based)
- Large scale: 1000s of concurrent players across 200 cities globally
- Goal: be the last team standing
- the entire game is minimal in design and assets with the theme of communism(cause commieD=comm(unist)i(com)eD(y))
- Teams are divided uniformly.
- Teams share everything(from ammo, dashes, and even HP)
- If the team HP goes to 0, the entire team dies.
- A team is revived with only n/2 of the number of players who were alive in the previous run.
- the players who get to live is decided by a random player in the team.
- dead players(the n/2 not selected to play), act as ghosts, who search and collect resources for the team.
- on the number of players in team reaching one, the team dies. and is eliminated.
02actual gameplay
- the entire game happens in a limited procedurally generated maze.
- each team begins in a large empty space surrounded by the maze. which is its spawn point. enemies cannot enter here. and spawn vulnerability is also here. 
- the whole game is top down 2d.
- the screen will consist of the following:
.top left=minimap which will either show the nearby area, minimap of the whole maze or a list of your teammates which you can quickly select from by using arrow keys to get the route to them.(these different modes can be switched by using x key)
.top center=performance and connection stats. strip format. with colour change for good, acceptable and bad stat values.
.bottom left=team reserves(ammo, dash, current powerup)
.bottom center=team health
.top right=comrats(stats of your comrades)
- you move around with wasd and arrowkeys, shift to dash. mouse to aim and click to shoot. hold click to for continuous fire. space for using special item
- special items are found around the world as collectibles strewn around in mazes
- the maze itself is a tiled system containing the following types of tiles: wall, free space,. this is saved and used by program with the help of a 1d array whose scale is fixed at a square for now.
- for ghosts, they can immediately switch between different tasks by using 1,2,3(clicker,ammo,dash)
- special items that can be triggered with space are 1 time and everyone gets the special item. in case more are collected, they become the current special item and the item before it is saved and becomes current item again when special items is empty. anybody can use this item and exhaust it for the entire team.(communism at peak).
- special items cannot be stacked. one can only be triggered when there are no current effects. effects are applied teamwide when triggered.
-special items can randomly spawn on any free 
03maze design:
- the maze is a structure with large spaces for the team spawn points.
- it will be a 3 pass system. first randomly set the spawn areas fo the different teams, then generate the maze then at last generate the special items.
- each tile is the same size as the player. the player is a circle with 1 pointed end. acting as gunpoint.
- the spawnpoint area is calculated as the sum of all the tiles per player(2 tiles per player). converted into a rectangle where the length and breadth have least difference.