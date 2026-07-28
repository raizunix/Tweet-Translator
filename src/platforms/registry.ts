import { AxiomAdapter } from "./axiom/adapter";
import { GmgnAdapter } from "./gmgn/adapter";
import { PadreAdapter } from "./padre/adapter";
import type { PlatformAdapter } from "./types";

export const adapters: PlatformAdapter[] = [
  new AxiomAdapter(),
  new GmgnAdapter(),
  new PadreAdapter()
];
export function adapterFor(url: URL): PlatformAdapter | undefined {
  return adapters.find((adapter) => adapter.supports(url));
}
