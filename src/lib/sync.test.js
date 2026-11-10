import { describe, expect, it } from "vitest";
import {
  stableStringify,
  syncFingerprint,
  computeStorageUsage,
  FIRESTORE_DOC_LIMIT,
} from "./sync";

describe("stableStringify", () => {
  it("ne dépend pas de l'ordre des clés", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      stableStringify({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 })
    );
  });

  it("produit du JSON valide pour des données sans undefined", () => {
    const value = { b: [1, "deux", null], a: { x: true } };
    expect(JSON.parse(stableStringify(value))).toEqual(value);
  });
});

describe("syncFingerprint", () => {
  it("ignore la navigation (lastActive)", () => {
    const data = { projects: [{ id: "p" }] };
    expect(syncFingerprint({ ...data, lastActive: { projectId: "a" } })).toBe(
      syncFingerprint({ ...data, lastActive: { projectId: "b" } })
    );
  });

  it("change dès que le contenu change", () => {
    expect(syncFingerprint({ projects: [{ id: "p" }] })).not.toBe(syncFingerprint({ projects: [] }));
  });
});

describe("computeStorageUsage", () => {
  it("mesure en octets (accents sur 2 octets)", () => {
    const usage = computeStorageUsage("é");
    expect(usage.used).toBe(2);
    expect(usage.limit).toBe(FIRESTORE_DOC_LIMIT);
    expect(usage.level).toBe("ok");
  });

  it("signale les seuils de 80 % et 95 %", () => {
    expect(computeStorageUsage("x".repeat(Math.ceil(FIRESTORE_DOC_LIMIT * 0.8))).level).toBe("warning");
    expect(computeStorageUsage("x".repeat(Math.ceil(FIRESTORE_DOC_LIMIT * 0.95))).level).toBe("critical");
  });
});
