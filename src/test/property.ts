import { tagArb as tagJsonArb } from "@tagdown/core/lib/test/property"
import * as fc from "fast-check"

import { Tag } from "../tag"

export { assertProperty, assertAsyncProperty, tagArb as tagJsonArb } from "@tagdown/core/lib/test/property"
export function tagArb(maxDepth: number): fc.Arbitrary<Tag> {
  return tagJsonArb(maxDepth).map((tag) => new Tag(tag))
}
