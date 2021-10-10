import {
  cloneTag as cloneTagJson,
  Content as ContentJson,
  contentToJson,
  isAttributeContent,
  isTagContent,
  isText,
  parseTag,
  Tag as TagJson,
  tagToJson,
} from "@tagdown/core"

import { isArrayLike, isIterable, toIsoString } from "../utils"
import { BaseTag } from "./base"
import { ReadonlyTag } from "./readonly"

// Types
export { cloneTag as cloneTagJson, Content as ContentJson, isText, Tag as TagJson } from "@tagdown/core"

// These like-types represent the allowed types that will eventually normalize to the type.
export type TagsLike = ArrayLike<TagLike> | Iterable<TagLike> | TagLike
export type TagLike = Tag | TagInput
export type AttributesLike = Attributes | AttributesInput
export type ContentsLike = Contents | ContentsInput
export type ContentLike = Content | ContentInput

// These input-types represent the allowed types that can be used as the input for the type.
export type TagInput = TagInputObject | string
export type TagInputObject = Omit<Partial<TagJson>, "attributes" | "contents"> & {
  attributes?: AttributesLike
  contents?: ContentsLike
}
export type AttributesInput = ArrayLike<TagLike> | Iterable<TagLike> | AttributesInputObject | Tag
export type AttributesInputObject = { [name: string]: TagValue | null | undefined }
export type ContentsInput = ArrayLike<ContentLike> | Iterable<ContentLike> | ContentLike
export type ContentInput = string | TagInput
export type TagValue = boolean | number | string | Date | Tag | TagInput

// We need to keep track of the input used when a tag was not found,
// so we can put it at the right place when assigning a value later on.
type MissingTagInput = {
  parent: Tag
  path: string[]
  isAttribute: boolean
}

// Refactor proof compared to: "parent" in input.
function isMissingTagInput(arg: any): arg is MissingTagInput {
  return (arg as MissingTagInput).parent !== undefined
}

function normalizeTags(tagsLike: TagsLike): Tag[] {
  return isArrayLike(tagsLike) || isNoStringIterable(tagsLike)
    ? Array.from(tagsLike, normalizeTag)
    : [normalizeTag(tagsLike)]
}

export class Tag extends BaseTag<Tag, Attributes, Contents> {
  private missingInput: MissingTagInput | null = null

  constructor(tagInput: TagInput | MissingTagInput = {}) {
    super()
    Object.defineProperty(this, "missingInput", { enumerable: false })
    if (isMissingTagInput(tagInput)) {
      this.setTag({ name: tagInput.path[tagInput.path.length - 1] })
      this.missingInput = {
        ...tagInput,
        path: tagInput.path.slice(0, -1),
      }
    } else {
      if (typeof tagInput === "string") {
        const tag = parseTag(tagInput)
        if (tag === null) throw new Error("expected tag in tagdown string")
        tagInput = tag
      }
      this.setTag(tagInput)
    }
  }

  // We cannot define a setter for this, as it will be required to have the same type as the getter.
  // And using a method has the convenience we can now return this rather than void.
  setAttributes(attributesInput: AttributesInput): this {
    this.attributes.splice(0, this.attributes.length, ...normalizeAttributesInput(attributesInput))
    return this
  }

  setText(text: string): this {
    this.setMissing()
    this.contents.splice(0, this.contents.length, text)
    return this
  }

  setContents(contentsInput: ContentsInput): this {
    this.contents.splice(0, this.contents.length, ...normalizeContentsInput(contentsInput))
    return this
  }

  get isMissing() {
    return this.missingInput !== null
  }

  setTag({
    isQuoted = false,
    isAttribute = false,
    name = "unnamed",
    attributes = [],
    isLiteral = false,
    contents = [],
    layout,
  }: TagInputObject = {}) {
    const newContents = normalizeContents(contents)
    Object.assign(this, {
      isQuoted,
      isAttribute,
      name,
      attributes: normalizeAttributes(attributes, newContents),
      isLiteral,
      contents: newContents,
      layout,
    })
  }

  assignTag(tagInput: TagInputObject): void {
    const source = { ...tagInput }
    if (source.contents) this.setContents(source.contents)
    if (source.attributes) this.setAttributes(source.attributes)
    delete source.attributes, source.contents
    Object.assign(this, tagInput)
  }

  // FIXME: Like Lars pointed out, having set and delete share a method call is stupidly dangerous.
  attr(path: string[] | string): Tag
  attr(tags: TagsLike): void
  attr(path: string[] | string, tagsLike: TagsLike): void
  attr(path: string[] | string, _arg: null | undefined): void
  attr(arg1: string[] | string | TagsLike, arg2?: TagsLike | null): Tag | void {
    let path: string[]
    if (Array.isArray(arg1) && (!arg1.length || arg2)) {
      path = arg1.slice()
    } else if (typeof arg1 === "string") {
      path = [arg1]
    } else {
      path = []
      arg2 = arg1 as TagsLike
    }
    const tags = arg2 ? normalizeTags(arg2) : []
    if (!arg2 && arguments.length === 2) {
      if (path.length) {
        const name = path.pop()!
        const tag = path.length ? this.attr(path) : this
        if (path.length && tag.isMissing) return
        tag.attributes.delete(name)
      }
      return
    }
    if (tags.length) {
      let attrs = this.attributes
      for (const name of path) {
        let attr = attrs.get(name)
        if (!attr) {
          let i = path.length
          const lastAttr = (attr = t(path[--i]))
          while (i-- > 0) {
            attr = t(path[i], [attr])
          }
          attrs.set(attr)
          attrs = lastAttr.attributes
          break
        }
        attrs = attr.attributes
      }
      for (const tag of tags) {
        attrs.set(tag)
      }
      return
    }
    if (!path.length) return new Tag({ parent: this, path, isAttribute: true })
    let tag: Tag = this
    for (const name of path) {
      const newTag = tag.attributes.get(name)
      if (!newTag) return new Tag({ parent: this, path, isAttribute: true })
      tag = newTag
    }
    return tag
  }

  attrs(path: string[] | string): Tag[]
  attrs(path: string[] | string, _arg: null | undefined): void
  attrs(path: string[] | string, _arg?: null): Tag[] | void {
    path = Array.isArray(path) ? path.slice() : [path]
    if (arguments.length === 2) {
      if (path.length) {
        const name = path.pop()!
        for (const attr of this.attrs(path)) {
          attr.attributes.deleteAll(name)
        }
      }
      return
    }
    if (!path.length) return []
    let tags: Tag[] = [this]
    for (const name of path) {
      const newTags: Tag[] = []
      for (const tag of tags) {
        newTags.push(...tag.attributes.getAll(name))
      }
      tags = newTags
    }
    return tags
  }

  tag(path: string[] | string): Tag
  tag(tags: TagsLike): void
  tag(path: string[] | string, tagsLike: TagsLike): void
  tag(path: string[] | string, _arg: null | undefined): void
  tag(arg1: string[] | string | TagsLike, arg2?: TagsLike | null): Tag | void {
    let path: string[]
    if (Array.isArray(arg1) && (!arg1.length || arg2)) {
      path = arg1.slice()
    } else if (typeof arg1 === "string") {
      path = [arg1]
    } else {
      path = []
      arg2 = arg1 as TagsLike
    }
    const tags = arg2 ? normalizeTags(arg2) : []
    if (!arg2 && arguments.length === 2) {
      if (path.length) {
        const name = path.pop()!
        const tag = path.length ? this.tag(path) : this
        if (path.length && tag.isMissing) return
        tag.contents.delete(name)
      }
      return
    } else if (tags.length) {
      let contents = this.contents
      for (const name of path) {
        let tag = contents.get(name)
        if (!tag) {
          let i = path.length
          const lastAttr = (tag = t(path[--i]))
          while (i-- > 0) {
            tag = t(path[i], [tag])
          }
          contents.set(tag)
          contents = lastAttr.contents
          break
        }
        contents = tag.contents
      }
      for (const tag of tags) {
        contents.set(tag)
      }
      return
    }
    if (!path.length) return new Tag({ parent: this, path, isAttribute: false })
    let tag: Tag = this
    for (const name of path) {
      const newTag = tag.contents.get(name)
      if (!newTag) return new Tag({ parent: this, path, isAttribute: false })
      tag = newTag
    }
    return tag
  }

  tags(path: string[] | string): Tag[]
  tags(path: string[] | string, _arg: null | undefined): void
  tags(path: string[] | string, _arg?: null): Tag[] | void {
    path = Array.isArray(path) ? path.slice() : [path]
    if (arguments.length === 2) {
      if (path.length) {
        const name = path.pop()!
        for (const tag of this.tags(path)) {
          tag.contents.deleteAll(name)
        }
      }
      return
    }
    if (!path.length) return []
    let tags: Tag[] = [this]
    for (const name of path) {
      const newTags: Tag[] = []
      for (const tag of tags) {
        newTags.push(...tag.contents.getAll(name))
      }
      tags = newTags
    }
    return tags
  }

  from(value: TagValue): this {
    this.setMissing()
    if (typeof value === "boolean") this.fromBoolean(value)
    else if (typeof value === "number") this.fromNumber(value)
    else if (typeof value === "string") this.setText(value)
    else if (value instanceof Date) this.fromDate(value)
    else if (value instanceof Tag) this.setText(value.text)
    else this.setContents(new Tag(value))
    return this
  }

  fromLiteral(literal: string): this {
    this.setMissing()
    this.setText(literal)
    this.isLiteral = true
    return this
  }

  fromBoolean(boolean: boolean): this {
    this.setMissing()
    this.setText(boolean.toString())
    return this
  }

  fromNumber(number: number): this {
    this.setMissing()
    this.setText(number.toString())
    return this
  }

  fromDate(date: Date): this {
    this.setMissing()
    this.setText(toIsoString(date))
    return this
  }

  freeze(): ReadonlyTag {
    return new ReadonlyTag(this)
  }

  clone(): Tag {
    return new Tag(cloneTagJson(this))
  }

  private setMissing(): void {
    if (!this.missingInput) return
    const { parent, path, isAttribute } = this.missingInput
    if (isAttribute) parent.attr(path, this)
    else parent.tag(path, this)
    this.missingInput = null
  }
}

export function normalizeTag(tagLike: TagLike): Tag {
  if (tagLike instanceof Tag) return tagLike
  return new Tag(tagLike)
}

export class Attributes extends Array<Tag> {
  constructor(attributesInput: AttributesInput, private contents: Content[]) {
    super(
      ...(typeof attributesInput !== "number"
        ? normalizeAttributesInput(attributesInput)
        : [attributesInput]),
    )
    Object.defineProperty(this, "contents", { enumerable: false })
  }

  get(name: string): Tag | null {
    for (const attr of this) if (attr.name === name) return attr
    for (const content of this.contents) {
      if (isAttributeContent(content) && content.name === name) return content
    }
    return null
  }

  getAll(name: string): Tag[] {
    const attrs: Tag[] = []
    for (const attr of this) if (attr.name === name) attrs.push(attr)
    for (const content of this.contents) {
      if (isAttributeContent(content) && content.name === name) attrs.push(content)
    }
    return attrs
  }

  set(attributesInput: AttributesInput): void {
    const attrs = normalizeAttributesInput(attributesInput)
    for (const attr of attrs) attr.isAttribute = true
    const indexLookup: { [name: string]: number } = {}
    attrs: for (const attr of attrs) {
      for (let i = indexLookup[attr.name] || 0; i < this.length; i++) {
        if (this[i].name === attr.name) {
          this[i] = attr
          indexLookup[attr.name] = i + 1
          continue attrs
        }
      }
      for (let i = 0; i < this.contents.length; i++) {
        const content = this.contents[i]
        if (isAttributeContent(content) && content.name === attr.name) {
          this.contents[i] = attr
          continue attrs
        }
      }
      this.push(attr)
    }
    for (const name in indexLookup) {
      for (let i = indexLookup[name] || 0; i < this.length; i++) {
        if (this[i].name === name) {
          this.splice(i, 1)
        }
      }
    }
  }

  add(attributesInput: AttributesInput): void {
    const attrs = normalizeAttributesInput(attributesInput)
    for (const attr of attrs) attr.isAttribute = true
    this.push(...attrs)
  }

  replace(searchAttribute: Tag, replaceAttribute: Tag): boolean {
    replaceAttribute.isAttribute = true
    for (let i = 0; i < this.length; i++) {
      if (this[i] === searchAttribute) {
        this.splice(i, 1, replaceAttribute)
        return true
      }
    }
    for (let i = 0; i < this.contents.length; i++) {
      const content = this.contents[i]
      if (isAttributeContent(content) && content === searchAttribute) {
        this.contents.splice(i, 1, replaceAttribute)
        return true
      }
    }
    return false
  }

  delete(name: string): boolean {
    for (let i = 0; i < this.length; i++) {
      if (this[i].name === name) {
        this.splice(i, 1)
        return true
      }
    }
    return false
  }

  deleteAll(name: string): boolean {
    let result = false
    for (let i = 0; i < this.length; i++) {
      if (this[i].name === name) {
        this.splice(i, 1)
        result = true
      }
    }
    return result
  }

  placeAtTop(names: string[]): void {
    const attrs = new Array(names.length)
    let count = 0
    let offset = 0
    for (let i = 0; i < this.length; i++) {
      const j = names.indexOf(this[i].name)
      if (j !== -1 && !attrs[j]) {
        const alreadyInPlace = j === i
        const isConsecutive = i === count
        if (alreadyInPlace && isConsecutive) {
          offset++
        } else {
          attrs[j] = this[i]
          this.splice(i, 1)
          i--
        }
        count++
        if (count === names.length) break
      }
    }
    this.splice(offset, 0, ...attrs.filter((attr) => attr !== undefined))
  }

  toJSON(): TagJson[] {
    return Array.from(this, tagToJson)
  }
}

function normalizeAttributes(attributesLike: AttributesLike, contents: Contents): Attributes {
  if (attributesLike instanceof Attributes) return attributesLike
  return new Attributes(attributesLike, contents)
}

function normalizeAttributesInput(attributesInput: AttributesInput): Tag[] {
  if (attributesInput instanceof Attributes) return attributesInput
  const attrs =
    isArrayLike(attributesInput) || isNoStringIterable(attributesInput)
      ? Array.from(attributesInput, normalizeTag)
      : !(attributesInput instanceof Tag)
      ? normalizeAttributesPlainObject(attributesInput)
      : [attributesInput]
  for (const attr of attrs) attr.isAttribute = true
  return attrs
}

function normalizeAttributesPlainObject(object: AttributesInputObject): Tag[] {
  const attrs: Tag[] = []
  for (const name of Object.keys(object)) {
    const value = object[name]
    if (value == null) continue
    const attr = new Tag({ name })
    attr.from(value)
    attrs.push(attr)
  }
  return attrs
}

export class Contents extends Array<Content> {
  constructor(contentsInput: ContentsInput) {
    super(...(typeof contentsInput !== "number" ? normalizeContentsInput(contentsInput) : [contentsInput]))
  }

  get(name: string): Tag | null {
    for (const content of this) {
      if (isTagContent(content) && content.name === name) return content
    }
    return null
  }

  getAll(name: string): Tag[] {
    const tags: Tag[] = []
    for (const content of this) {
      if (isTagContent(content) && content.name === name) tags.push(content)
    }
    return tags
  }

  set(tagsLike: TagsLike): void {
    const tags = normalizeTags(tagsLike)
    const indexLookup: { [name: string]: number } = {}
    tags: for (const tag of tags) {
      for (let i = indexLookup[tag.name] || 0; i < this.length; i++) {
        const content = this[i]
        if (isTagContent(content) && content.name === tag.name) {
          this[i] = tag
          indexLookup[tag.name] = i + 1
          continue tags
        }
      }
    }
    for (const name in indexLookup) {
      for (let i = indexLookup[name] || 0; i < this.length; i++) {
        const content = this[i]
        if (isTagContent(content) && content.name === name) {
          this.splice(i, 1)
        }
      }
    }
  }

  add(contentsInput: ContentsInput): void {
    const contents = normalizeContentsInput(contentsInput)
    const lastIndex = this.length - 1
    if (isText(contents[0]) && isText(this[lastIndex])) {
      this[lastIndex] += contents.shift() as string
    }
    this.push(...contents)
  }

  replace(searchTag: Tag, replaceTag: Tag): boolean {
    for (let i = 0; i < this.length; i++) {
      if (this[i] === searchTag) {
        this.splice(i, 1, replaceTag)
        return true
      }
    }
    return false
  }

  delete(name: string): boolean {
    for (let i = 0; i < this.length; i++) {
      const content = this[i]
      if (isTagContent(content) && content.name === name) {
        this.splice(i, 1)
        return true
      }
    }
    return false
  }

  deleteAll(name: string): boolean {
    let result = false
    for (let i = 0; i < this.length; i++) {
      const content = this[i]
      if (isTagContent(content) && content.name === name) {
        this.splice(i, 1)
        result = true
      }
    }
    return result
  }

  toJSON(): ContentJson[] {
    return Array.from(this, contentToJson)
  }
}

function normalizeContents(contentsLike: ContentsLike): Contents {
  if (contentsLike instanceof Contents) return contentsLike
  return new Contents(contentsLike)
}

function normalizeContentsInput(contentsInput: ContentsInput): Content[] {
  if (contentsInput instanceof Contents) return contentsInput
  return isArrayLike(contentsInput) || isNoStringIterable(contentsInput)
    ? Array.from(contentsInput, normalizeContent)
    : [normalizeContent(contentsInput)]
}

export type Content = string | Tag

function normalizeContent(contentLike: ContentLike): Content {
  return !isText(contentLike) ? normalizeTag(contentLike) : contentLike
}

// Check

function isNoStringIterable(arg: any): arg is Exclude<Iterable<any>, string> {
  return typeof arg !== "string" && isIterable(arg)
}

export function isTag(arg: any): arg is Tag {
  return arg instanceof Tag
}

export function isContent(arg: any): arg is Content {
  return isText(arg) || isTag(arg)
}

export function isContents(arg: any): arg is Content[] {
  return Array.isArray(arg) && arg.every(isContent)
}

// Shorthands

export function t(tagInput: TagInput): Tag
export function t(name: string): Tag
export function t(name: string, contentsLike: ContentsLike): Tag
export function t(name: string, attributesLike: AttributesLike, contentsLike: ContentsLike): Tag
export function t(arg1: TagInput | string, arg2?: ContentsLike | AttributesLike, arg3?: ContentsLike): Tag {
  if (typeof arg1 === "object") return new Tag(arg1)
  const input: TagInputObject = { name: arg1 }
  if (arg2) {
    if (!arg3) {
      input.contents = arg2
    } else {
      input.attributes = arg2 as AttributesLike
      input.contents = arg3
    }
  }
  return new Tag(input)
}

export function tl(name: string): Tag
export function tl(name: string, text: string): Tag
export function tl(name: string, attributesLike: AttributesLike): Tag
export function tl(name: string, attributesLike: AttributesLike, text: string): Tag
export function tl(name: string, arg2?: string | AttributesLike, arg3?: string): Tag {
  const input: TagInputObject = { name, isLiteral: true }
  if (arg2) {
    if (!arg3) {
      if (isText(arg2)) {
        input.contents = arg2
      } else {
        input.attributes = arg2
      }
    } else {
      input.attributes = arg2 as AttributesLike
      input.contents = arg3
    }
  }
  return new Tag(input)
}
