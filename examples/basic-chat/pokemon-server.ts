import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";

interface PokeStat {
  name: string;
  value: number;
}

interface PokeType {
  name: string;
  slot: number;
}

interface PokeAbility {
  name: string;
  hidden: boolean;
}

export interface PokemonResult {
  name: string;
  id: number;
  sprite: string;
  artwork: string;
  types: PokeType[];
  stats: PokeStat[];
  abilities: PokeAbility[];
  height: number;
  weight: number;
}

export function createPokemonServer() {
  return createSdkMcpServer({
    name: "pokemon",
    tools: [
      tool(
        "pokemon_lookup",
        "Look up a Pokémon by name or Pokédex number and return its stats, types, abilities, and sprites",
        { query: z.string().describe("Pokémon name or Pokédex number") },
        async ({ query }) => {
          const res = await fetch(
            `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(query.toLowerCase())}`,
          );
          if (!res.ok) {
            return {
              content: [{ type: "text" as const, text: `Pokémon "${query}" not found.` }],
              isError: true,
            };
          }
          const data = await res.json();
          const result: PokemonResult = {
            name: data.name,
            id: data.id,
            sprite: data.sprites.front_default,
            artwork:
              data.sprites.other?.["official-artwork"]?.front_default ?? data.sprites.front_default,
            types: data.types.map((t: { slot: number; type: { name: string } }) => ({
              name: t.type.name,
              slot: t.slot,
            })),
            stats: data.stats.map((s: { base_stat: number; stat: { name: string } }) => ({
              name: s.stat.name,
              value: s.base_stat,
            })),
            abilities: data.abilities.map(
              (a: { ability: { name: string }; is_hidden: boolean }) => ({
                name: a.ability.name,
                hidden: a.is_hidden,
              }),
            ),
            height: data.height,
            weight: data.weight,
          };
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
          };
        },
      ),
    ],
  });
}
