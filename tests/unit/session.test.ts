import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El store de favoritos importa una Server Action; aquí solo interesa que `init` reciba los datos
const init = vi.fn();
vi.mock("@/hooks/use-favorites", () => ({ useFavorites: { getState: () => ({ init }) } }));

import { useSession } from "@/hooks/use-session";

const user = { id: "u1", name: "Ana Pérez", role: "CUSTOMER" as const };
const reply = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  init.mockClear();
  useSession.setState({ ready: false, user: null });
});
afterEach(() => vi.unstubAllGlobals());

describe("useSession", () => {
  it("carga el usuario y entrega los favoritos al store de favoritos", async () => {
    vi.stubGlobal("fetch", vi.fn(() => reply({ user, favoriteIds: ["p1", "p2"] })));
    await useSession.getState().refresh();
    expect(useSession.getState()).toMatchObject({ ready: true, user });
    expect(init).toHaveBeenCalledWith(["p1", "p2"], true);
  });

  it("sin sesión deja user=null y favoritos vacíos (no autenticado)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => reply({ user: null, favoriteIds: [] })));
    await useSession.getState().refresh();
    expect(useSession.getState().user).toBeNull();
    expect(init).toHaveBeenCalledWith([], false);
  });

  it("varias llamadas simultáneas comparten una sola petición", async () => {
    const f = vi.fn(() => reply({ user, favoriteIds: [] }));
    vi.stubGlobal("fetch", f);
    await Promise.all([useSession.getState().refresh(), useSession.getState().refresh(), useSession.getState().refresh()]);
    expect(f).toHaveBeenCalledTimes(1);
    await useSession.getState().refresh(); // terminada la anterior, una nueva sí consulta
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("la petición no usa caché y conserva las cookies", async () => {
    const f = vi.fn(() => reply({ user: null, favoriteIds: [] }));
    vi.stubGlobal("fetch", f);
    await useSession.getState().refresh();
    expect(f).toHaveBeenCalledWith("/api/session", expect.objectContaining({ cache: "no-store", credentials: "same-origin" }));
  });

  it("si falla la red o el servidor conserva el último usuario conocido", async () => {
    useSession.setState({ ready: true, user });
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    await useSession.getState().refresh();
    expect(useSession.getState().user).toEqual(user);
    vi.stubGlobal("fetch", vi.fn(() => reply({}, false)));
    await useSession.getState().refresh();
    expect(useSession.getState().user).toEqual(user);
  });

  it("clear() cierra la sesión en el cliente y vacía los favoritos", () => {
    useSession.setState({ ready: true, user });
    useSession.getState().clear();
    expect(useSession.getState().user).toBeNull();
    expect(init).toHaveBeenCalledWith([], false);
  });
});
