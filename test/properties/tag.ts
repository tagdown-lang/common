import { printTag, shakeTag } from "@tagdown/core"
import { logExpr } from "@tagdown/core/lib/test/log"

import { Tag } from "../../src"
import { assertProperty, tagJsonArb } from "../../src/test/property"

assertProperty(
  tagJsonArb(5),
  (tag) => printTag(new Tag(shakeTag(tag))) === printTag(tag),
  (tag) => {
    logExpr(`tag`, tag)
    logExpr(`shakeTag(tag)`, shakeTag(tag))
    logExpr(`new Tag(shakeTag(tag))`, new Tag(shakeTag(tag)))
    logExpr(`printTag(new Tag(shakeTag(tag)))`, printTag(new Tag(shakeTag(tag))))
    logExpr(`printTag(tag)`, printTag(tag))
  },
)
