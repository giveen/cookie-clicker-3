/**
 * core/game.ts — the engine's `Game` singleton, now a real class (Phase 3).
 *
 * The 2.048 engine built `Game` at runtime as `var Game = {}` (top of
 * engine/main.ts) and attached every property to that bare object. The
 * singleton is now an instance of the `GameCore` class below: the engine
 * imports it and keeps assigning the exact same properties, and the window
 * shim publishes the same object, so the runtime surface is unchanged
 * (same identity, same assignment sequence, same window.Game).
 *
 * `GameCore` stays an index-signature shell: the named surface of `Game`
 * (lifecycle, economy, save/load, shimmers, …) is described by the `Game`
 * interface in types.ts, and the singleton below is cast to it once so
 * every `Game.X` in the engine and in the extracted modules checks
 * against those named members (the interface's own index signature still
 * covers the legacy dynamic surface).
 */
import type { Game as GameSurface } from '../types';

export class GameCore {
	[key: string]: any;
}

/** The engine's `Game` singleton (was `var Game={}` in engine/main.ts).
 * The index-signature shell is cast to the canonical `Game` surface once,
 * here: from this point every `Game.X` in the engine and every extracted
 * module checks against the named members of types.ts (the interface's own
 * index signature still covers the legacy dynamic surface). */
export const Game = new GameCore() as GameSurface;
