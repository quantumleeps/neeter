import { registerWidget, type WidgetProps } from "@neeter/react";

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

interface PokemonResult {
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

const TYPE_COLORS: Record<string, string> = {
  normal: "bg-stone-400",
  fire: "bg-orange-500",
  water: "bg-blue-500",
  electric: "bg-yellow-400",
  grass: "bg-green-500",
  ice: "bg-cyan-300",
  fighting: "bg-red-700",
  poison: "bg-purple-500",
  ground: "bg-amber-600",
  flying: "bg-indigo-300",
  psychic: "bg-pink-500",
  bug: "bg-lime-500",
  rock: "bg-yellow-700",
  ghost: "bg-purple-700",
  dragon: "bg-indigo-600",
  dark: "bg-stone-700",
  steel: "bg-slate-400",
  fairy: "bg-pink-300",
};

function StatBar({ name, value }: PokeStat) {
  const pct = Math.min((value / 255) * 100, 100);
  const label = name
    .replace("special-attack", "Sp. Atk")
    .replace("special-defense", "Sp. Def")
    .replace("hp", "HP")
    .replace("attack", "Atk")
    .replace("defense", "Def")
    .replace("speed", "Spd");
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-14 text-right text-muted-foreground shrink-0">{label}</span>
      <span className="w-7 tabular-nums text-right shrink-0">{value}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/70 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PokemonLookupInputRenderer({ input }: { input: Record<string, unknown> }) {
  const query = typeof input.query === "string" ? input.query : null;
  if (!query) return null;
  return (
    <div className="mt-1.5 text-xs text-muted-foreground">
      Looking up <span className="font-semibold capitalize">{query}</span>
    </div>
  );
}

function PokemonLookupWidget({ result, phase, input }: WidgetProps<PokemonResult>) {
  if (phase === "running" || phase === "pending") {
    const query = typeof input.query === "string" ? input.query : "Pokémon";
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <span className="animate-pulse">Looking up {query}&hellip;</span>
      </div>
    );
  }

  if (!result || typeof result !== "object") return null;

  return (
    <div className="flex gap-4 py-2">
      <img
        src={result.artwork || result.sprite}
        alt={result.name}
        width={96}
        height={96}
        className="shrink-0 rounded-lg bg-muted/50 object-contain"
      />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold capitalize">{result.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">#{result.id}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {result.types.map((t) => (
            <span
              key={t.name}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white capitalize ${TYPE_COLORS[t.name] ?? "bg-gray-500"}`}
            >
              {t.name}
            </span>
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">
            {(result.height / 10).toFixed(1)}m · {(result.weight / 10).toFixed(1)}kg
          </span>
        </div>
        <div className="space-y-0.5">
          {result.stats.map((s) => (
            <StatBar key={s.name} {...s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
          {result.abilities.map((a) => (
            <span key={a.name} className="capitalize">
              {a.name}
              {a.hidden && " (hidden)"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

registerWidget<PokemonResult>({
  toolName: "pokemon_lookup",
  label: "Pokémon",
  richLabel: (r) => `${r.name.charAt(0).toUpperCase() + r.name.slice(1)} #${r.id}`,
  inputRenderer: PokemonLookupInputRenderer,
  component: PokemonLookupWidget,
});
