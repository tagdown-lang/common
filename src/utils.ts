export type Primitive = bigint | boolean | null | number | string | symbol | undefined

type JSONValue = Primitive | JSONObject | JSONArray

interface JSONObject {
  [key: string]: JSONValue
}

interface JSONArray extends Array<JSONValue> {}

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P] extends ReadonlyArray<infer E> ? Mutable<E>[] : Mutable<T[P]>
}

export function isJsonObject(arg: any): arg is JSONObject {
  return typeof arg === "object" && arg !== null && Object.getPrototypeOf(arg) === Object.prototype
}

export function isArrayLike(arg: any): arg is ArrayLike<any> {
  return (
    typeof arg === "object" && arg !== null && arg.hasOwnProperty("length") && typeof arg.length === "number"
  )
}

export function isIterable(arg: any): arg is Iterable<any> {
  return arg != null && typeof arg[Symbol.iterator] === "function"
}

// https://stackoverflow.com/questions/17415579/how-to-iso-8601-format-a-date-with-timezone-offset-in-javascript
export function toIsoString(date: Date): string {
  const tzo = -date.getTimezoneOffset()
  const dif = tzo >= 0 ? "+" : "-"
  const pad = (num: number, len = 2) => num.toString().padStart(len, "0")
  return (
    pad(date.getFullYear()) +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes()) +
    ":" +
    pad(date.getSeconds()) +
    "." +
    pad(date.getMilliseconds(), 3) +
    dif +
    pad(Math.floor(Math.abs(tzo / 60))) +
    ":" +
    pad(Math.floor(Math.abs(tzo % 60)))
  )
}
