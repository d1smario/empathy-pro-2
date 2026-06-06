import assert from "node:assert/strict";
import test from "node:test";
import { fdcDescriptionToLabelIt } from "@/lib/nutrition/v2/fdc-food-label-it";

test("fdcDescriptionToLabelIt: pasta e pollo in italiano", () => {
  assert.equal(
    fdcDescriptionToLabelIt("Pasta, cooked, unenriched, without added salt"),
    "Pasta di semola",
  );
  assert.equal(
    fdcDescriptionToLabelIt("Chicken, broilers or fryers, breast, meat only, cooked, roasted"),
    "Petto di pollo",
  );
  assert.equal(fdcDescriptionToLabelIt("Spinach, raw"), "Spinaci");
});
