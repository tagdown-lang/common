import * as fc from "fast-check"
import { logExpr } from "@tagdown/core/lib/test/log"

import { toIsoString } from "../../src"
import { assertProperty } from "../../src/test/property"

assertProperty(
  fc.date({ min: new Date(Date.UTC(1970, 0)), max: new Date(Date.UTC(2200, 0)) }),
  (date) => new Date(toIsoString(date)).getTime() === date.getTime(),
  (date) => {
    logExpr(`date`, date)
    logExpr(`toIsoString(date)`, toIsoString(date))
    logExpr(`new Date(toIsoString(date)).toISOString()`, new Date(toIsoString(date)).toISOString())
    logExpr(`date.toISOString()`, date.toISOString())
  },
)
