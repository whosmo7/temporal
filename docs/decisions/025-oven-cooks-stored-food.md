# 025: The oven cooks stored food to eat

**Status:** decided 2026-10-24 by the user · **Settles:** the oven question in [010](010-player-house.md)

## Decision

At the oven, "Cook and eat" eats food from the cabinet to refill hunger (`hungerPerFoodEaten`). It's free, and refused
when you're full. Until now only freshly harvested food could be eaten (016).

## Consequences

- Stored food can now be eaten, so a hungry player can use what predecessors left.
- Open in `13`: is it an interaction on the store, or a ninth action `cook`?
