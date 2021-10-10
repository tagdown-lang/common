import {
  contentToJson,
  isAttributeContent,
  isTagContent,
  mapTagContent,
  TagLayout,
  tagToJson,
} from "@tagdown/core"

import { Attributes, cloneTagJson, ContentJson, Contents, Tag, TagJson } from "."
import { BaseTag } from "./base"

type ReadonlyReadonlyAttributes = ReadonlyDerivedArray<ReadonlyTag, ReadonlyAttributes>
type ReadonlyReadonlyContents = ReadonlyDerivedArray<ReadonlyContent, ReadonlyContents>
type ReadonlyDerivedArray<E, A> = ReadonlyArray<E> & Omit<A, keyof Array<E>>

export class ReadonlyTag extends BaseTag<ReadonlyTag, ReadonlyReadonlyAttributes, ReadonlyReadonlyContents> {
  readonly isQuoted: boolean
  readonly isAttribute: boolean
  readonly name: string
  readonly attributes: ReadonlyReadonlyAttributes
  readonly isLiteral: boolean
  readonly contents: ReadonlyReadonlyContents
  readonly layout?: TagLayout

  constructor(tag: Tag) {
    super()
    const contents = new ReadonlyContents(tag.contents)
    Object.assign(this, {
      ...tag,
      attributes: new ReadonlyAttributes(tag.attributes, contents),
      contents,
    })
    // This would make it no longer extensible.
    // Object.freeze(this)
  }

  attr(path: string[] | string): ReadonlyTag | null {
    path = Array.isArray(path) ? path.slice() : [path]
    if (!path.length) return null
    let tag: ReadonlyTag = this
    for (const name of path) {
      const newTag = tag.attributes.get(name)
      if (!newTag) return null
      tag = newTag
    }
    return tag
  }

  attrs(path: string[] | string): ReadonlyTag[] {
    path = Array.isArray(path) ? path.slice() : [path]
    if (!path.length) return []
    let tags: ReadonlyTag[] = [this]
    for (const name of path) {
      const newTags: ReadonlyTag[] = []
      for (const tag of tags) {
        newTags.push(...tag.attributes.getAll(name))
      }
      tags = newTags
    }
    return tags
  }

  tag(path: string[] | string): ReadonlyTag | null {
    path = Array.isArray(path) ? path.slice() : [path]
    if (!path.length) return null
    let tag: ReadonlyTag = this
    for (const name of path) {
      const newTag = tag.contents.get(name)
      if (!newTag) return null
      tag = newTag
    }
    return tag
  }

  tags(path: string[] | string): ReadonlyTag[] {
    path = Array.isArray(path) ? path.slice() : [path]
    if (!path.length) return []
    let tags: ReadonlyTag[] = [this]
    for (const name of path) {
      const newTags: ReadonlyTag[] = []
      for (const tag of tags) {
        newTags.push(...tag.contents.getAll(name))
      }
      tags = newTags
    }
    return tags
  }

  unfreeze(): Tag {
    return new Tag(this)
  }

  clone(): ReadonlyTag {
    return new ReadonlyTag(new Tag(cloneTagJson(this)))
  }
}

class ReadonlyAttributes extends Array<ReadonlyTag> {
  constructor(attributes: Attributes, private contents: ReadonlyContents) {
    super(
      ...(typeof attributes !== "number" ? attributes.map((attr) => new ReadonlyTag(attr)) : [attributes]),
    )
    Object.defineProperty(this, "contents", { enumerable: false })
    // This would make .map fail.
    // Object.freeze(this)
  }

  get(name: string): ReadonlyTag | null {
    for (const attr of this) {
      if (attr.name === name) return attr
    }
    for (const content of this.contents) {
      if (isAttributeContent(content) && content.name === name) return content
    }
    return null
  }

  getAll(name: string): ReadonlyTag[] {
    const attrs: ReadonlyTag[] = []
    for (const attr of this) {
      if (attr.name === name) attrs.push(attr)
    }
    for (const content of this.contents) {
      if (isAttributeContent(content) && content.name === name) attrs.push(content)
    }
    return attrs
  }

  toJSON(): TagJson[] {
    return Array.from(this, tagToJson)
  }
}

class ReadonlyContents extends Array<ReadonlyContent> {
  constructor(contents: Contents) {
    super(
      ...(typeof contents !== "number"
        ? contents.map(mapTagContent((tag) => new ReadonlyTag(tag)))
        : [contents]),
    )
    // This would make .map fail.
    // Object.freeze(this)
  }

  get(name: string): ReadonlyTag | null {
    for (const content of this) {
      if (isTagContent(content) && content.name === name) return content
    }
    return null
  }

  getAll(name: string): ReadonlyTag[] {
    const tags: ReadonlyTag[] = []
    for (const content of this) {
      if (isTagContent(content) && content.name === name) tags.push(content)
    }
    return tags
  }

  toJSON(): ContentJson[] {
    return Array.from(this, contentToJson)
  }
}

type ReadonlyContent = string | ReadonlyTag
