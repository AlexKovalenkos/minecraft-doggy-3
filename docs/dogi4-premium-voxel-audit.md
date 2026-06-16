# dogi4 Premium Voxel Audit

Goal: move the game toward a premium cinematic Minecraft-inspired world.

Reference logic:
- Ref 1: macro world scale, terraced mountains, valleys, water masses, sunlight, cinematic composition.
- Ref 2: local asset quality, trees, rocks, props, paths, waterfalls, cozy premium voxel detail.
- Hybrid: hero landmarks such as castle mountain, central valley, large waterfall, viewpoint routes.

## Terrain / Landscape

Current state: readable but still too flat around the first route, with many objects sitting on separate islands of style.
Form: strengthen big terraced silhouettes, valleys, foreground/midground/background composition.
Texture/material: keep pixel grass/dirt, add moss, dry spots, stone breaks, shore variation.
Scale: big forms should be readable from spawn and while flying.
Reference: Ref 1.
Proposal: a cinematic valley with distant mountain walls, stepped plateaus, route views, and clear water basins.
Actions:
- Add distant mountain walls outside the playable grid.
- Add stepped foreground terraces near the first route.
- Keep terrain simple from afar but detailed near paths and water.

## Mountains / Cliffs

Current state: improved but still can read as stacked boxes in places.
Form: add vertical ridges, asymmetric ledges, shadowed cuts, snow shelves.
Texture/material: richer stone with cracks, light edges, dark cavities, moss at ledges.
Scale: mountains must overpower houses and trees without hiding navigation.
Reference: Ref 1 for silhouette, Ref 2 for nearby detail.
Proposal: mountains as cinematic skyline plus premium local rock clusters.
Actions:
- Use procedural stone/snow materials.
- Add ridge strips and side ledges.
- Add local rock clusters at paths, water, and castle base.

## Water / Rivers / Waterfalls

Current state: lake and waterfall exist, but need stronger scenic integration.
Form: water should create route and composition, not just pools.
Texture/material: transparent aqua, foam strips, stepping stones, shallow shelves.
Scale: river must connect lake to castle visually.
Reference: hybrid.
Proposal: water as a scenic spine from lake toward castle mountain.
Actions:
- Add narrow river segments and bank stones.
- Add foam around waterfalls.
- Add reeds, moss stones, and water-edge props.

## Trees / Vegetation

Current state: better than v0.8, but still needs premium composition and hero vegetation.
Form: varied crowns, branch silhouettes, roots, grouped clusters.
Texture/material: bark grain, leaf holes, bright tops, dark interiors.
Scale: trees should support world scale and not look like identical props.
Reference: Ref 2.
Proposal: premium voxel trees with asymmetry, mass, and readable canopies.
Actions:
- Keep upgraded tree builders.
- Add a hero tree along the main route.
- Cluster vegetation near water, paths, and rocks.

## Buildings / Castle / Houses

Current state: castle and house are present but need stronger integration with terrain.
Form: less toy-like, more architecture: beams, supports, trims, buttresses.
Texture/material: stone, wood, roof shingles, warm light, worn materials.
Scale: castle is hero landmark; house is cozy local prop.
Reference: Ref 2 for object quality, hybrid for castle.
Proposal: fantasy voxel architecture built into the landscape.
Actions:
- Keep muted castle palette and stone detail.
- Add route props/lanterns and terrain connection.
- Continue reducing flat wall surfaces in later passes.

## Paths / Props / Navigation

Current state: functional paths exist but some read as simple strips.
Form: paths need broken edges, slabs, stones, posts, lanterns.
Texture/material: dirt, plank, stone, moss.
Scale: readable at dog height, not too busy from above.
Reference: Ref 2.
Proposal: paths become scenic routes and composition guides.
Actions:
- Add slab-like path pieces toward the castle.
- Add lanterns at key turns.
- Add rock clusters and moss at path edges.

## Characters / Animals / Creatures

Current state: dog and animals are readable, but not fully integrated with the new premium style.
Form: keep blocky silhouettes, strengthen material language later.
Texture/material: add fur/cloth/scale pixel variation in future pass.
Scale: maintain clear gameplay readability.
Reference: Ref 2.
Proposal: premium voxel creatures with simple strong bodies and richer materials.
Actions:
- Fixed current dog runtime error.
- Next pass: dog fur/material, sheep wool, dragon scale/ridge pass.

## Current dogi4 implementation pass

Implemented in this checkpoint:
- Distant cinematic mountain walls.
- Central terraced valley and viewpoint shapes.
- Scenic river/path spine toward castle.
- Hero old voxel tree near main route.
- More rock clusters, lanterns, water-edge details.
- Runtime fix for dog scale variable.

Next recommended pass:
- Expand playable terrain composition, not just decorative overlays.
- Redesign animal and dragon materials.
- Add more biome-level grouping instead of random scatter.
- Refine castle base into a more natural cliff-village landmark.
