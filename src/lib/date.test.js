import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatShortDate, getDeadlineStatus } from "./date";

describe("formatShortDate", () => {
  it("formate une date sans décalage de fuseau", () => {
    expect(formatShortDate("2027-05-20")).toBe("20 mai");
  });

  it("retourne une chaîne vide pour une valeur absente", () => {
    expect(formatShortDate(null)).toBe("");
    expect(formatShortDate("")).toBe("");
  });
});

describe("getDeadlineStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retourne null pour une échéance absente", () => {
    expect(getDeadlineStatus(null)).toBeNull();
    expect(getDeadlineStatus("")).toBeNull();
  });

  it("classe une date passée comme dépassée", () => {
    vi.setSystemTime(new Date(2027, 5, 15, 10, 0, 0));
    expect(getDeadlineStatus("2027-06-14")).toBe("overdue");
  });

  it("classe le jour même comme aujourd'hui, même juste avant minuit", () => {
    vi.setSystemTime(new Date(2027, 5, 15, 23, 45, 0));
    expect(getDeadlineStatus("2027-06-15")).toBe("today");
  });

  it("classe le jour même comme aujourd'hui, même juste après minuit", () => {
    vi.setSystemTime(new Date(2027, 5, 15, 0, 5, 0));
    expect(getDeadlineStatus("2027-06-15")).toBe("today");
  });

  it("classe une date future comme à venir", () => {
    vi.setSystemTime(new Date(2027, 5, 15, 10, 0, 0));
    expect(getDeadlineStatus("2027-06-16")).toBe("upcoming");
  });
});
