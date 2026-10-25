# Hackathon presentation

Open `/temporal/#/presentation`, or choose **Our story** on the home screen.

The seven chapters are manually paced. Scroll, use the chapter buttons, or press Left/Right
or Page Up/Page Down. Home restarts; End reaches the game home. Keyboard shortcuts leave
links, buttons, the trailer and the scoring slider alone. There is no automatic slide timer, and the only
audio is the trailer's, once you press play.

## Suggested introduction (about two and a half minutes)

1. **Time** (~15 seconds): “We are all victims of time. It exposes the consequences our intentions hide.”
2. **The evidence** (~15 seconds): “When the tap runs, the lights come on, or food grows in the soil, we rely on systems built and maintained before us. We inherit their care, or the cost of its absence.”
3. **The balance** (~20 seconds): “We need resources to live. The challenge is leaving the next generation the same possibility.”
4. **Inheritance** (~20 seconds): “A two-minute life in a shared world. Six generations in sequence. Click the generation buttons: your life ends, the world continues.”
5. **The trailer** (32 seconds): press play. It never starts on its own, and it pauses when you move to another
   chapter. While the video has focus, ← → seek it instead of changing chapter; click outside it to page again.
6. **The temptation** (~35 seconds): Click **Keep the surplus**, then **Empty the store**. “Taking a little can pay. Taking too much costs corruption and the quality of the world you hand over. Your own exit-world bonus locks at death.”
7. **What remains** (~15 seconds): “The journal passes on. The replay exposes the consequences. What will you leave?”

The final chapter embeds the real `LandingScreen`: Play, Gallery and How to play retain their
existing routes. **Enter game** in the header also goes straight to the normal home route.
Login and actual gameplay behave as usual; the presentation does not claim or commit a world.

## Truth and sources

- The scoring example is explicitly synthetic: 24 inherited food plus 24 gathered, with the rest
  of the world seeded normally. It executes the real `take` actions and `endTurn`; its score is
  neither a hard-coded animation nor real player data. It is a controlled illustration, not a
  full balance simulation or a promise that a single strategy always wins.
- The journal fragment is labelled imagined. The decorative tunnel islands are illustrations,
  not six actual snapshots from a played world.
- The Paul Hawken quotation follows _Blessed Unrest_ (2007), p. 187; the attribution is linked to a
  [SAGE-hosted excerpt](https://uk.sagepub.com/sites/default/files/upm-assets/52625_book_item.pdf).
- The presentation describes the scoring in decision 039. It does not claim Elo exists.
- The user explicitly requested an explanation of scores outside gameplay. No hidden information
  rules, gameplay UI, engine, backend, or stored player history are changed.

## Component integration

The attached `PerspectiveTunnelHero` is adapted in `src/components/ui/perspective-tunnel-hero.tsx`.
Framer Motion retains the staggered depth travel, but native page scrolling replaces its wheel
trap. Reduced motion removes depth travel. The imagery is the existing local island art;
no remote stock images are loaded. Layout, typography and controls use the existing game CSS
and UI kit rather than introducing a second Tailwind/shadcn styling system. TypeScript is
already configured; no CLI scaffolding is necessary for this component.

The route loads lazily, keeping its animation dependency out of the game's initial route bundle.
Assets and fonts are local. After the app has loaded, the presentation itself needs no backend.
The page supports mobile reading even though the game is designed for desktop.
