import * as fc from "fast-check"
import { isTagContents, isTextContents, printTag, shakeTag } from "@tagdown/core"
import { logExpr } from "@tagdown/core/lib/test/log"

import { Tag } from "../../src"
import { TagValue } from "../../src/tag"
import { assertProperty, tagArb, tagJsonArb } from "../../src/test/property"

const tagValueArb = fc.oneof(
  fc.boolean(),
  fc.integer(),
  fc.double({ next: true }),
  fc.fullUnicodeString(),
  fc.date({ min: new Date(Date.UTC(1950, 0)), max: new Date(Date.UTC(9999, 0)) }),
  tagArb(5),
  tagJsonArb(5).map(shakeTag),
)

function tagToValue(tag: Tag, originalValue: TagValue): TagValue {
  if (typeof originalValue === "boolean") return tag.toBoolean()
  else if (typeof originalValue === "number") return tag.toNumber()
  else if (typeof originalValue === "string") return tag.text
  else if (originalValue instanceof Date) return tag.toDate()
  else if (originalValue instanceof Tag)
    return isTextContents(originalValue.contents) ? originalValue.clone().setText(tag.text) : originalValue
  else return isTagContents(tag.contents) ? shakeTag(tag.contents[0].toJSON()) : tag.contents[0]
}

function printTagValue(value: TagValue): string {
  return (
    typeof value === "object" && !(value instanceof Date) && !(value instanceof Tag) ? new Tag(value) : value
  ).toString()
}

assertProperty(
  fc.tuple(tagArb(5), tagValueArb),
  ([tag, value]) => printTagValue(tagToValue(tag.clone().from(value), value)) === printTagValue(value),
  ([tag, value]) => {
    logExpr(`tag`, tag)
    logExpr(`value`, value)
    logExpr(`tag.clone().from(value)`, tag.clone().from(value))
    logExpr(`valueFromTag(tag.clone().from(value), value)`, tagToValue(tag.clone().from(value), value))
    logExpr(
      `printTagValue(valueFromTag(tag.clone().from(value), value))`,
      printTagValue(tagToValue(tag.clone().from(value), value)),
    )
    logExpr(`printTagValue(value)`, printTagValue(value))
  },
)

assertProperty(
  tagArb(5),
  (tag) => printTag(tag.toJSON()) === printTag(tag),
  (tag) => {
    logExpr(`tag`, tag)
    logExpr(`tag.toJSON()`, tag.toJSON())
    logExpr(`printTag(tag.toJSON())`, printTag(tag.toJSON()))
    logExpr(`printTag(tag)`, printTag(tag))
  },
)

assertProperty(
  fc.tuple(tagArb(5), fc.integer()),
  ([tag, length]) => {
    const truncatedLength = tag.truncate(length).length
    return (length <= 0 && truncatedLength === 0) || (length > 0 && truncatedLength <= length)
  },
  ([tag, length]) => {
    logExpr(`tag`, tag)
    logExpr(`length`, length)
    logExpr(`tag.truncate(length)`, tag.truncate(length))
    logExpr(`tag.truncate(length).length`, tag.truncate(length).length)
  },
)
