import { describe, expect, it } from "vitest";
import { groupCreatorsByCraft } from "../creatorCategories";

describe("creator category rails", () => {
  it("puts each ranked user into one craft rail without dropping or duplicating them", () => {
    const users = [{ id: "a", role: "Photographer" }, { id: "b", role: "Musician" }, { id: "c", role: "Video editor" }, { id: "d", role: "Fashion stylist" }];
    const groups = groupCreatorsByCraft(users);
    expect(groups.map(g => g.id)).toEqual(["photo_video", "music", "fashion"]);
    expect(groups[0].creators.map(c => c.id)).toEqual(["a", "c"]);
    expect(groups.flatMap(g => g.creators).map(c => c.id).sort()).toEqual(["a", "b", "c", "d"]);
  });
  it("keeps users whose role is unknown discoverable in Creator", () => {
    expect(groupCreatorsByCraft([{ id: "new", role: null }])[0].creators[0].id).toBe("new");
  });
});