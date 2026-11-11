import { compareVersions } from "../src/utils/versions";

describe("compareVersions", () => {
  it("finds newer patch, minor and major versions", () => {
    expect(compareVersions("1.0.1", "1.0")).toBeGreaterThan(0);
    expect(compareVersions("1.1.0", "1.0.9")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
  });

  it("compares numerically, not as text", () => {
    expect(compareVersions("1.0.10", "1.0.9")).toBeGreaterThan(0);
  });

  it("ignores a leading v and treats missing parts as zero", () => {
    expect(compareVersions("v1.0.1", "1.0.1")).toBe(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
  });

  it("reports older versions as negative", () => {
    expect(compareVersions("1.0.0", "1.0.1")).toBeLessThan(0);
  });

  it("ignores pre-release and build suffixes", () => {
    expect(compareVersions("1.0.1-beta", "1.0.1")).toBe(0);
  });
});
