const { vi } = await import("vitest");

export default {
  watch: vi.fn(_path => {
    const watcher = {
      on: vi.fn(_ => watcher)
    };
    return watcher;
  }),
};