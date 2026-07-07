# SEP-1330: 引出枚举模式改进与标准合规

- **状态**: Final
- **类型**: Standards Track
- **创建时间**: 2025-08-11
- **作者**: chughtapan
- **问题**: #1330

## 摘要

本 SEP 提议改进 MCP 中的枚举模式定义，弃用非标准的 `enumNames` 属性，转而采用符合 JSON Schema 的模式，并在单选模式之外，新增对多选枚举模式的支持。新模式已根据 JSON 规范进行了验证。

**Schema Changes:** https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1148
Typescript SDK Changes: https://github.com/modelcontextprotocol/typescript-sdk/pull/1077
Python SDK Changes: https://github.com/modelcontextprotocol/python-sdk/pull/1246
**Client Implementation:** https://github.com/evalstate/fast-agent/pull/324/files
**Working Demo:** https://asciinema.org/a/anBvJdqEmTjw0JkKYOooQa5Ta

## 动机

现有的枚举 schema 在为枚举值添加标题时采用了一种非标准的方法。它还将 Elicitation（以及未来任何应该采用 `EnumSchema` 的其他 schema 对象）中的枚举使用限制为单选模型。用户常常需要选择多个条目。在 UI 中，这相当于使用复选框与单选按钮之间的区别。

基于这些原因，我们提出以下不会破坏兼容性的 `EnumSchema` 小幅改进，以提升用户和开发者体验。

- 将现有的 `EnumSchema` 保留为“Legacy”
  - 它为枚举值添加标题时使用了非标准方法
  - 将其标记为 Legacy，但暂时仍予以支持
  - 根据 @dsp-ant 的说法，当我们有了合适的弃用策略时，会将其标记为已弃用
- 引入无标题（Untitled）与有标题（Titled）枚举的区分。
  - 如果枚举值本身已经足够，则无需为每个值单独指定标题。
  - 如果枚举值不适合直接展示，则可以为每个值指定标题。
- 引入单选（Single）与多选（Multi-select）枚举的区分。
  - 如果只能选择一个值，则可以使用单选 schema
  - 如果可以选择多个值，则可以使用多选 schema
- 在 `ElicitResponse` 中，将数组作为一种 `additionalProperty` 类型
  - 允许将枚举值的多选结果返回给服务器

## 规范

### 1. 将带有非标准 `enumNames` 属性的当前 `EnumSchema` 标记为“旧版”

当前 MCP 规范使用非标准的 `enumNames` 属性为枚举值提供显示名称。我们建议将 `enumNames` 属性标记为旧版，并建议使用 `TitledSingleSelectEnum`，这是我们在下文定义的、符合标准的枚举类型。

```typescript
// 继续将当前 EnumSchema 作为旧版支持

/**
 * 旧版：请改用 TitledSingleSelectEnumSchema。
 * 此接口将在未来版本中移除。
 */
export interface LegacyEnumSchema {
  type: "string";
  title?: string;
  description?: string;
  enum: string[];
  enumNames?: string[]; // 枚举值的标题（非标准，旧版）
}
```

### 2. 定义单选枚举（包含带标题和不带标题两种形式）

枚举可能需要标题，也可能不需要。枚举值本身可能已经是适合展示的人类可读文本。在这种情况下，使用 JSON Schema 关键字 `enum` 的不带标题实现会更简单。若需要标题，则需要将 `enum` 数组替换为由 `const` 和 `title` 组成的对象数组。

```typescript
// 不带标题的单选枚举
export type UntitledSingleSelectEnumSchema = {
  type: "string";
  title?: string;
  description?: string;
  enum: string[]; // 不带标题的普通枚举
};

// 带标题的单选枚举
export type TitledSingleSelectEnumSchema = {
  type: "string";
  title?: string;
  description?: string;
  oneOf: Array<{
    const: string; // 枚举值
    title: string; // 枚举值的显示名称
  }>;
};

// 组合的单选枚举
export type SingleSelectEnumSchema =
  UntitledSingleSelectEnumSchema | TitledSingleSelectEnumSchema;
```

### 3. 引入多选枚举（包含带标题和不带标题两种形式）

虽然 elicitation 不支持数组和对象这类任意 JSON 类型，因此客户端可以轻松显示选择项，但多选枚举仍然可以很容易地实现。

```typescript
// 不带标题的多选枚举
export type UntitledMultiSelectEnumSchema = {
  type: "array";
  title?: string;
  description?: string;
  minItems?: number; // 需要选择的最少项目数
  maxItems?: number; // 需要选择的最多项目数
  items: {
    type: "string";
    enum: string[]; // 不带标题的普通枚举
  };
};

// 带标题的多选枚举
export type TitledMultiSelectEnumSchema = {
  type: "array";
  title?: string;
  description?: string;
  minItems?: number; // 需要选择的最少项目数
  maxItems?: number; // 需要选择的最多项目数
  items: {
    oneOf: Array<{
      const: string; // 枚举值
      title: string; // 枚举值的显示名称
    }>;
  };
};

// 组合的多选枚举
export type MultiSelectEnumSchema =
  UntitledMultiSelectEnumSchema | TitledMultiSelectEnumSchema;
```

### 4. 将所有变体合并为 `EnumSchema`

最终的 `EnumSchema` 将旧版、多选和单选模式合并为一个，定义如下：

```typescript
// 组合的旧版、多选和单选枚举
export type EnumSchema =
  SingleSelectEnumSchema | MultiSelectEnumSchema | LegacyEnumSchema;
```

### 5. 扩展 ElicitResult

当前的 elicitation 结果模式只允许返回原始类型。我们将其扩展为支持多选枚举的字符串数组：

```typescript
export interface ElicitResult extends Result {
  action: "accept" | "decline" | "cancel";
  content?: { [key: string]: string | number | boolean | string[] }; // string[] 是新增的
}
```

## 实例 Schema 示例

### 单选，无标题（无变化）

```json
{
  "type": "string",
  "title": "颜色选择",
  "description": "选择你喜欢的颜色",
  "enum": ["Red", "Green", "Blue"],
  "default": "Green"
}
```

### 旧版带标题的单选

```json
{
  "type": "string",
  "title": "颜色选择",
  "description": "选择你喜欢的颜色",
  "enum": ["#FF0000", "#00FF00", "#0000FF"],
  “enumNames”: ["Red", "Green", "Blue"],
  "default": "Green"
}
```

### 带标题的单选

```json
{
  "type": "string",
  "title": "颜色选择",
  "description": "选择你喜欢的颜色",
  "oneOf": [
    { "const": "#FF0000", "title": "红色" },
    { "const": "#00FF00", "title": "绿色" },
    { "const": "#0000FF", "title": "蓝色" }
  ],
  "default": "#00FF00"
}
```

### 无标题的多选

```json
{
  "type": "array",
  "title": "颜色选择",
  "description": "选择你喜欢的颜色",
  "minItems": 1,
  "maxItems": 3,
  "items": {
    "type": "string",
    "enum": ["Red", "Green", "Blue"]
  },
  "default": ["Green"]
}
```

### 带标题的多选

```json
{
  "type": "array",
  "title": "颜色选择",
  "description": "选择你喜欢的颜色",
  "minItems": 1,
  "maxItems": 3,
  "items": {
    "anyOf": [
      { "const": "#FF0000", "title": "红色" },
      { "const": "#00FF00", "title": "绿色" },
      { "const": "#0000FF", "title": "蓝色" }
    ]
  },
  "default": ["Green"]
}
```

## 理由

1. **标准合规性**：与官方 JSON Schema 规范保持一致。标准模式可与现有 JSON Schema 验证器配合使用
2. **灵活性**：支持普通枚举，以及带有显示名称的单选和多选枚举。
3. **客户端实现：**表明实现一组复选框相对于单个复选框的额外开销很小：https://github.com/evalstate/fast-agent/pull/324/files

## 向后兼容性

`LegacyEnumSchema` 类型在迁移期间保持向后兼容。使用 `enumNames` 的现有实现将继续正常工作，直到实施整个协议范围的弃用策略，并移除此 schema。

## 参考实现

**架构变更：** https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1148
Typescript SDK 变更: https://github.com/modelcontextprotocol/typescript-sdk/pull/1077
Python SDK 变更: https://github.com/modelcontextprotocol/python-sdk/pull/1246
**客户端实现：** https://github.com/evalstate/fast-agent/pull/324/files
**可运行演示：** https://asciinema.org/a/anBvJdqEmTjw0JkKYOooQa5Ta

## 安全注意事项

未发现安全影响。此更改纯粹涉及模式结构和标准合规性。

## 附录

### 验证

使用 https://www.jsonschemavalidator.net/ 中 JSON Schema Validator 里保存的验证结果，我们验证：

- 本文档中的所有示例实例模式与下一节中提议的 JSON 元模式 `EnumSchema` 进行验证。
- 依据本文档中的示例实例模式验证有效和无效的值。

#### 传统单选

- `EnumSchema` 验证[带标题的传统单选实例模式](https://www.jsonschemavalidator.net/s/lsK7Bn0C)
- 传统带标题的单选实例模式验证[一个正确的单选](https://www.jsonschemavalidator.net/s/GSk7rnRe)
- 传统带标题的单选实例模式验证[一个错误的单选](https://www.jsonschemavalidator.net/s/3kYvxsVP)

#### 单选

- `EnumSchema` 验证[不带标题的单选实例模式](https://www.jsonschemavalidator.net/s/MBlHW5IQ)
- `EnumSchema` 验证[带标题的单选实例模式](https://www.jsonschemavalidator.net/s/s38xt4JV)
- 不带标题的单选实例模式验证[一个正确的单选](https://www.jsonschemavalidator.net/s/M0hkYoeG)
- 不带标题的单选实例模式使[一个错误的单选](https://www.jsonschemavalidator.net/s/3Try4BCt)失效
- 带标题的单选实例模式验证[一个正确的单选](https://www.jsonschemavalidator.net/s/4oDbv9yt)
- 带标题的单选实例模式使[一个错误的单选](https://www.jsonschemavalidator.net/s/A2KlNzLH)失效

#### 多选

- `EnumSchema` 验证[不带标题的多选实例模式](https://www.jsonschemavalidator.net/s/4uc3Ndsq)
- `EnumSchema` 验证[带标题的多选实例模式](https://www.jsonschemavalidator.net/s/TmkIqqXI)
- 不带标题的多选实例模式验证[一个正确的多选](https://www.jsonschemavalidator.net/s/IE8Bkvtg)
  不带标题的多选实例模式使[一个错误的多选](https://www.jsonschemavalidator.net/s/8tlqjUgW)失效
  带标题的多选实例模式验证[一个正确的多选](https://www.jsonschemavalidator.net/s/Nb1Rw1qa)
  带标题的多选实例模式使[一个错误的多选](https://www.jsonschemavalidator.net/s/MRfyqrVC)失效

### JSON 元模式

这是我们对规范中当前 `schema.json` 里的 `EnumSchema` 替代方案的建议。

```json
{
  "$schema": "https://json-schema.org/draft-07/schema",
  "definitions": {
    // 新定义如下
    "UntitledSingleSelectEnumSchema": {
      "type": "object",
      "properties": {
        "type": { "const": "string" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "enum": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1
        }
      },
      "required": ["type", "enum"],
      "additionalProperties": false
    },

    "UntitledMultiSelectEnumSchema": {
      "type": "object",
      "properties": {
        "type": { "const": "array" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "minItems": {
          "type": "number",
          "minimum": 0
        },
        "maxItems": {
          "type": "number",
          "minimum": 0
        },
        "items": {
          "type": "object",
          "properties": {
            "type": { "const": "string" },
            "enum": {
              "type": "array",
              "items": { "type": "string" },
              "minItems": 1
            }
          },
          "required": ["type", "enum"],
          "additionalProperties": false
        }
      },
      "required": ["type", "items"],
      "additionalProperties": false
    },

    "TitledSingleSelectEnumSchema": {
      "type": "object",
      "required": ["type", "anyOf"],
      "properties": {
        "type": { "const": "string" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "anyOf": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["const", "title"],
            "properties": {
              "const": { "type": "string" },
              "title": { "type": "string" }
            },
            "additionalProperties": false
          }
        }
      },
      "additionalProperties": false
    },

    "TitledMultiSelectEnumSchema": {
      "type": "object",
      "required": ["type", "anyOf"],
      "properties": {
        "type": { "const": "array" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "anyOf": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["const", "title"],
            "properties": {
              "const": { "type": "string" },
              "title": { "type": "string" }
            },
            "additionalProperties": false
          }
        }
      },
      "additionalProperties": false
    },

    "LegacyEnumSchema": {
      "properties": {
        "type": {
          "type": "string",
          "const": "string"
        },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "enum": {
          "type": "array",
          "items": { "type": "string" }
        },
        "enumNames": {
          "type": "array",
          "items": { "type": "string" }
        }
      },
      "required": ["enum", "type"],
      "type": "object"
    },

    "EnumSchema": {
      "oneOf": [
        { "$ref": "#/definitions/UntitledSingleSelectEnumSchema" },
        { "$ref": "#/definitions/UntitledMultiSelectEnumSchema" },
        { "$ref": "#/definitions/TitledSingleSelectEnumSchema" },
        { "$ref": "#/definitions/TitledMultiSelectEnumSchema" },
        { "$ref": "#/definitions/LegacyEnumSchema" }
      ]
    }
  }
}
```
