export type UserFields = {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "string[]" | "json";
  input: boolean;
  required?: boolean;
  fieldName?: string;
  defaultValue?: string | number | boolean | string[] | Record<string, unknown>;
};

export const userFields: UserFields[] = [
  {
    name: "panel",
    type: "string",
    input: false,
  },
  {
    name: "metadata",
    type: "json",
    input: true,
    required: false,
  },
  {
    name: "employeeId",
    type: "string",
    input: false,
    required: false,
  },
  {
    name: "employeeEmail",
    type: "string",
    input: false,
    required: false,
  },
  {
    name: "country",
    type: "string",
    input: false,
    required: false,
  },
  {
    name: "state",
    type: "string",
    input: false,
    required: false,
  },
  {
    name: "city",
    type: "string",
    input: false,
    required: false,
  },
];

export const userAdditionalFields = Object.fromEntries(
  userFields.map((field) => [
    field.name,
    {
      type: field.type,
      input: field.input,
      required: field.required,
      fieldName: field.fieldName,
      defaultValue: field.defaultValue,
    },
  ])
);
