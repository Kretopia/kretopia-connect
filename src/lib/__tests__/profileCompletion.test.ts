import { describe, it, expect } from "vitest";
import { checkProfileCompletion, meetsDiscoveryRequirements, getDiscoveryMissingFields } from "@/lib/profileCompletion";

// Minimal mock profile matching the Database type
const createMockProfile = (overrides: Record<string, any> = {}) => ({
  user_id: "test-user-id",
  full_name: "New User",
  role: "Creator",
  bio: null,
  avatar_url: null,
  location: null,
  professional_skills: null,
  passion_skills: null,
  website: null,
  linkedin_url: null,
  instagram_url: null,
  twitter_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  onboarding_completed: false,
  onboarding_step: 0,
  subscription_tier: "free",
  subscription_status: "inactive",
  ...overrides,
} as any);

describe("Profile Completion", () => {
  describe("checkProfileCompletion", () => {
    it("returns 0% for empty/default profile", () => {
      const profile = createMockProfile();
      const result = checkProfileCompletion(profile, 0);
      expect(result.percentage).toBe(0);
      expect(result.isComplete).toBe(false);
      expect(result.missingFields.length).toBeGreaterThan(0);
    });

    it("returns 100% for fully completed profile", () => {
      const profile = createMockProfile({
        full_name: "Jane Doe",
        role: "Designer",
        bio: "A passionate creative designer with years of experience",
        avatar_url: "https://example.com/avatar.jpg",
        location: "New York",
        professional_skills: ["Design", "UX", "Branding"],
        website: "https://janedoe.com",
      });
      const result = checkProfileCompletion(profile, 1);
      expect(result.percentage).toBe(100);
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it("calculates partial completion correctly", () => {
      const profile = createMockProfile({
        full_name: "Jane Doe",
        avatar_url: "https://example.com/avatar.jpg",
      });
      const result = checkProfileCompletion(profile, 0);
      expect(result.percentage).toBeGreaterThan(0);
      expect(result.percentage).toBeLessThan(100);
      expect(result.completedFields).toContain("Full Name");
      expect(result.completedFields).toContain("Profile Picture");
    });
  });

  describe("meetsDiscoveryRequirements", () => {
    it("returns false without avatar", () => {
      const profile = createMockProfile({ bio: "A meaningful bio that is long enough" });
      expect(meetsDiscoveryRequirements(profile, 1)).toBe(false);
    });

    it("returns false without meaningful bio", () => {
      const profile = createMockProfile({ avatar_url: "https://example.com/pic.jpg", bio: "short" });
      expect(meetsDiscoveryRequirements(profile, 1)).toBe(false);
    });

    it("returns false without portfolio", () => {
      const profile = createMockProfile({
        avatar_url: "https://example.com/pic.jpg",
        bio: "A meaningful bio that is long enough",
      });
      expect(meetsDiscoveryRequirements(profile, 0)).toBe(false);
    });

    it("returns true when all requirements met", () => {
      const profile = createMockProfile({
        avatar_url: "https://example.com/pic.jpg",
        bio: "A meaningful bio that is long enough",
      });
      expect(meetsDiscoveryRequirements(profile, 1)).toBe(true);
    });
  });

  describe("getDiscoveryMissingFields", () => {
    it("lists all missing fields for empty profile", () => {
      const profile = createMockProfile();
      const missing = getDiscoveryMissingFields(profile, 0);
      expect(missing).toContain("Profile Picture");
      expect(missing).toContain("Bio (20+ characters)");
      expect(missing).toContain("At least 1 Work Item (Portfolio or Credit)");
    });

    it("returns empty array when all met", () => {
      const profile = createMockProfile({
        avatar_url: "https://example.com/pic.jpg",
        bio: "A meaningful bio that is long enough",
      });
      const missing = getDiscoveryMissingFields(profile, 1);
      expect(missing).toHaveLength(0);
    });
  });
});
